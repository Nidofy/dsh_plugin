using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using Microsoft.Win32.SafeHandles;

// Read-only native boundary. There is deliberately no SetSecurityInfo, process
// launcher, arbitrary PowerShell, restore command, or recursive ACL reset here.
internal static class Program
{
    const uint ReadControl = 0x20000, OpenExisting = 3;
    const uint OpenReparsePoint = 0x200000, BackupSemantics = 0x2000000;
    const uint SecurityFields = 1 | 2 | 4 | 0x10; // owner, group, DACL, label; NOT audit SACL
    static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    record Entry(string Path, string FinalPath, string Identity, string Descriptor, string DescriptorHash,
        string Sddl, bool Directory, bool ReparsePoint, uint Links, int? IntegrityRid,
        bool LabelInherited, bool LabelInheritable, bool DaclProtected, string Owner);
    record Failure(string Path, string Code);

    static int Main(string[] args)
    {
        try
        {
            if (!OperatingSystem.IsWindows()) throw new InvalidOperationException("WINDOWS_REQUIRED");
            if (args.Length == 1 && args[0] == "capabilities")
            {
                Console.WriteLine(JsonSerializer.Serialize(new { protocol = 1, readOnly = true,
                    architecture = RuntimeInformation.ProcessArchitecture.ToString(),
                    windowsSandboxPresent = File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "WindowsSandbox.exe")),
                    isolatedExecutionQualified = false }, Json));
                return 0;
            }
            if (args.Length != 3 || args[0] != "scan" || !int.TryParse(args[2], out var limit) || limit < 1 || limit > 10000)
                throw new ArgumentException("USAGE: scan <absolute local path> <1..10000> | capabilities");
            var root = LocalPath(args[1]);
            var entries = new List<Entry>(); var failures = new List<Failure>();
            var ancestors = new List<Entry>(); var pending = new Queue<string>();
            for (var parent = Directory.GetParent(root); parent != null; parent = parent.Parent)
                ancestors.Add(Inspect(parent.FullName));
            if (ancestors.Any(x => x.ReparsePoint)) throw new InvalidOperationException("REPARSE_ANCESTOR");
            pending.Enqueue(root);
            while (pending.Count > 0 && entries.Count + failures.Count < limit)
            {
                var path = pending.Dequeue();
                try
                {
                    var entry = Inspect(path);
                    if (!Inside(root, entry.FinalPath)) throw new InvalidOperationException("PATH_CHANGED");
                    entries.Add(entry);
                    if (entry.ReparsePoint) { failures.Add(new(path, "REPARSE_NOT_TRAVERSED")); continue; }
                    if (!entry.Directory) continue;
                    // Bound both queue growth and output. Incomplete reports cannot authorize recovery.
                    foreach (var child in Directory.EnumerateFileSystemEntries(path))
                    {
                        if (pending.Count + entries.Count + failures.Count >= limit) { pending.Enqueue(""); break; }
                        pending.Enqueue(child);
                    }
                }
                catch (Exception ex) { failures.Add(new(path, Code(ex))); }
            }
            Console.WriteLine(JsonSerializer.Serialize(new { protocol = 1, root, capturedAt = DateTimeOffset.UtcNow,
                complete = pending.Count == 0 && failures.Count == 0, entries, ancestors, failures }, Json));
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(JsonSerializer.Serialize(new { error = Code(ex) }, Json));
            return 2;
        }
    }

    static string Code(Exception ex) => ex is Win32Exception native ? $"WIN32_{native.NativeErrorCode}" :
        ex is UnauthorizedAccessException ? "ACCESS_DENIED" : ex is IOException ? "IO_ERROR" : ex.Message;

    static string LocalPath(string path)
    {
        if (!Path.IsPathFullyQualified(path) || path.Length < 3 || path[1] != ':' || path.StartsWith("\\\\") ||
            path[2..].Contains(':') || path.Contains('\0') || path.Split('\\', '/').Skip(1).Any(s => s.EndsWith('.') || s.EndsWith(' ')))
            throw new ArgumentException("LOCAL_ABSOLUTE_PATH_REQUIRED");
        return Path.TrimEndingDirectorySeparator(Path.GetFullPath(path));
    }

    static bool Inside(string root, string path) => path.Equals(root, StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith(root.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase);

    static Entry Inspect(string path)
    {
        using var handle = CreateFileW(path, ReadControl, 7, IntPtr.Zero, OpenExisting, OpenReparsePoint | BackupSemantics, IntPtr.Zero);
        if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
        if (!GetFileInformationByHandle(handle, out var info)) throw new Win32Exception(Marshal.GetLastWin32Error());
        var final = new StringBuilder(32768);
        var length = GetFinalPathNameByHandleW(handle, final, (uint)final.Capacity, 0);
        if (length == 0 || length >= final.Capacity) throw new Win32Exception(Marshal.GetLastWin32Error());
        var finalPath = final.ToString();
        if (finalPath.StartsWith("\\\\?\\")) finalPath = finalPath[4..];
        finalPath = Path.TrimEndingDirectorySeparator(finalPath);
        // A changed parent junction must not silently turn a local audit into an audit elsewhere.
        if (!finalPath.Equals(LocalPath(path), StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("PATH_ALIAS_OR_RACE");
        var error = GetSecurityInfo(handle, 1, SecurityFields, out _, out _, out _, out _, out var sd);
        if (error != 0) throw new Win32Exception((int)error);
        try
        {
            var bytes = new byte[GetSecurityDescriptorLength(sd)]; Marshal.Copy(sd, bytes, 0, bytes.Length);
            var descriptor = new RawSecurityDescriptor(bytes, 0);
            int? rid = null; bool inherited = false, inheritable = false;
            if (descriptor.SystemAcl != null)
                foreach (GenericAce ace in descriptor.SystemAcl)
                {
                    if ((byte)ace.AceType != 17) continue; // SYSTEM_MANDATORY_LABEL_ACE
                    var binary = new byte[ace.BinaryLength]; ace.GetBinaryForm(binary, 0);
                    var sid = new SecurityIdentifier(binary, 8).Value;
                    rid = int.Parse(sid.Split('-')[^1]);
                    inherited = (ace.AceFlags & AceFlags.Inherited) != 0;
                    inheritable = (ace.AceFlags & (AceFlags.ContainerInherit | AceFlags.ObjectInherit)) != 0;
                }
            return new(path, finalPath, $"{info.VolumeSerialNumber:X8}:{info.FileIndexHigh:X8}{info.FileIndexLow:X8}",
                Convert.ToBase64String(bytes), Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
                ToSddl(sd), (info.FileAttributes & 0x10) != 0, (info.FileAttributes & 0x400) != 0, info.NumberOfLinks,
                rid, inherited, inheritable, (descriptor.ControlFlags & ControlFlags.DiscretionaryAclProtected) != 0,
                descriptor.Owner?.Value ?? "");
        }
        finally { LocalFree(sd); }
    }

    static string ToSddl(IntPtr sd)
    {
        if (!ConvertSecurityDescriptorToStringSecurityDescriptorW(sd, 1, SecurityFields, out var text, out _))
            throw new Win32Exception(Marshal.GetLastWin32Error());
        try { return Marshal.PtrToStringUni(text) ?? ""; } finally { LocalFree(text); }
    }

    [StructLayout(LayoutKind.Sequential)] struct FileInfo
    {
        public uint FileAttributes; public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
        public uint VolumeSerialNumber, FileSizeHigh, FileSizeLow, NumberOfLinks, FileIndexHigh, FileIndexLow;
    }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern SafeFileHandle CreateFileW(string name, uint access, uint share, IntPtr attributes, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInfo info);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint size, uint flags);
    [DllImport("advapi32.dll")] static extern uint GetSecurityInfo(SafeFileHandle handle, uint type, uint fields, out IntPtr owner, out IntPtr group, out IntPtr dacl, out IntPtr sacl, out IntPtr descriptor);
    [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool ConvertSecurityDescriptorToStringSecurityDescriptorW(IntPtr descriptor, uint revision, uint fields, out IntPtr text, out uint length);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr memory);
}
