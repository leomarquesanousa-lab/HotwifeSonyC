export function parseCatalogCSV(text, existingNumbers = []) {
  if(text.length>1000000) throw new Error('CSV exceeds 1 MB');
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++) { const ch=text[i]; if(ch==='"') { if(quoted && text[i+1]==='"') {cell+='"';i++;} else if(!quoted && cell) throw new Error('Unexpected quote in CSV'); else quoted=!quoted; } else if(!quoted && ch===',') {row.push(cell);cell='';} else if(!quoted && (ch==='\n'||ch==='\r')) {if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean)) rows.push(row);row=[];cell='';} else cell+=ch; }
  if(quoted) throw new Error('Unclosed CSV quote'); row.push(cell);if(row.some(Boolean))rows.push(row);
  const headers=rows.shift()?.map(v=>v.replace(/^\uFEFF/,'').trim());
  const required=['number','title','participantsRaw','duration'];
  if(!headers || required.some(h=>!headers.includes(h)) || new Set(headers).size!==headers.length) throw new Error('Required CSV headers: number,title,participantsRaw,duration');
  const used=new Set(existingNumbers);
  return rows.map((values,index)=>{ if(values.length!==headers.length) throw new Error(`CSV row ${index+2}: column count mismatch`); const raw=Object.fromEntries(headers.map((h,i)=>[h,values[i]])); const number=Number(raw.number);
    if(!Number.isSafeInteger(number)||number<1||used.has(number)) throw new Error(`CSV row ${index+2}: invalid or duplicate number`);used.add(number);
    if(!raw.title?.trim()||!raw.participantsRaw?.trim()||!raw.duration?.trim())throw new Error(`CSV row ${index+2}: missing required value`);
    return {id:`sony-${String(number).padStart(3,'0')}`,number,title:raw.title,participantsRaw:raw.participantsRaw,participants:raw.participantsRaw==='—'?[]:raw.participantsRaw.split(/, | \+ /),duration:raw.duration,sourcePage:0,platformUrl:raw.platformUrl||null,status:'review',reviewNotes:'CSV import: verify official source before activation.',checkedAgainstSource:false};
  });
}
