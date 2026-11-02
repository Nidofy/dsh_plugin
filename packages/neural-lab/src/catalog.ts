import { readFile } from 'node:fs/promises'
import type { Catalog } from './types.ts'
export async function loadCatalog():Promise<Catalog> {
 const c:Catalog=JSON.parse(await readFile(new URL('../content/catalog.json',import.meta.url),'utf8'))
 const lectures:Record<string,{body:string;summary:string;hints:string[];commonErrors:string[]}>=JSON.parse(await readFile(new URL('../content/lectures.json',import.meta.url),'utf8'))
 for(const lesson of c.lessons){const lecture=lectures[lesson.id];if(!lecture)throw new Error('Missing lecture '+lesson.id);lesson.body=lecture.body;lesson.summary=lecture.summary;const exercise=lesson.exercises.find(e=>e.id===lesson.id+'-code');if(exercise){exercise.hints=lecture.hints;exercise.commonErrors=lecture.commonErrors}}
 validateCatalog(c)
 return c
}
export function validateCatalog(c:Catalog):void {
 if(c.version!=='0.1.0'||c.lessons.length!==12)throw new Error('Invalid course version/count')
 const ids=new Set(c.lessons.map(l=>l.id));if(ids.size!==c.lessons.length)throw new Error('Duplicate lesson identity');const exercises=new Set<string>();const visited=new Set<string>();const active=new Set<string>()
 const visit=(id:string):void=>{if(active.has(id))throw new Error('Prerequisite cycle');if(visited.has(id))return;const l=c.lessons.find(l=>l.id===id);if(!l)throw new Error('Missing prerequisite '+id);active.add(id);for(const p of l.prerequisites)visit(p);active.delete(id);visited.add(id)}
 for(const l of c.lessons){if(!l.body||!l.summary||!ids.has(l.id))throw new Error('Incomplete lesson');visit(l.id);for(const e of l.exercises){if(exercises.has(e.id)||e.lessonId!==l.id||e.hints.length<3||!e.prompt)throw new Error('Invalid exercise');exercises.add(e.id)}}
}
