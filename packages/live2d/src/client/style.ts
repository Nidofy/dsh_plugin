export const css = `
[data-nidofy-live2d-space]{margin-right:364px!important}
.dsh-live2d{color:var(--dsw-alias-label-primary,#ededed);font:calc(var(--dsh-content-font-size,14px) - 1px)/1.5 var(--dsw-font-family,system-ui);text-align:left;color-scheme:inherit}
.dsh-live2d *{box-sizing:border-box}
.dsh-live2d button,.dsh-live2d input{font:inherit;color:inherit}
.dsh-live2d button{cursor:pointer;background:transparent;border:1px solid transparent;border-radius:8px;padding:5px 9px}
.dsh-live2d button:hover,.dsh-live2d button[aria-pressed=true]{background:var(--dsw-alias-bg-overlay,#ffffff12)}
.dsh-live2d button:focus-visible,.dsh-live2d input:focus-visible{outline:2px solid #89b4fa;outline-offset:2px}
.live2d-card{position:absolute;width:340px;pointer-events:auto;border:1px solid var(--dsw-alias-border-l2,#ffffff14);background:var(--dsw-alias-bg-layer-2,#292929);border-radius:16px;box-shadow:0 8px 28px #0002;display:flex;flex-direction:column;overflow:hidden}
.live2d-header{display:flex;align-items:center;gap:6px;padding:12px 12px 4px;flex:none}
.live2d-header strong{flex:1}.live2d-status{font-size:.92em;color:var(--dsw-alias-label-secondary,#a4a4a4);padding:0 20px 6px;flex:none}
.live2d-stage{position:relative;min-height:80px;flex:1;overflow:hidden}
.live2d-stage img{position:absolute;max-width:none;object-fit:fill;pointer-events:none}
.live2d-stage iframe{position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none}
.live2d-stage p{padding:20px}.live2d-controls{padding:8px 12px 12px;overflow:auto;max-height:45%;flex:none;border-top:1px solid var(--dsw-alias-border-l2,#ffffff14)}
.live2d-controls label{display:flex;align-items:center;gap:8px;margin:6px 0}.live2d-controls input[type=range]{min-width:0;flex:1;accent-color:#9ecaff}
.live2d-footer{padding:6px 16px 12px;font-size:.9em;color:var(--dsw-alias-label-secondary,#a4a4a4);flex:none}
`
