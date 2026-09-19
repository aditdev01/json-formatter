const $ = id => document.getElementById(id);
const jsonInput=$("jsonInput"), jsonPreview=$("jsonPreview"), previewCode=jsonPreview.querySelector("code");
const lineNumbers=$("lineNumbers"), status=$("status"), statusDot=$("statusDot"), message=$("message");
const lineStat=$("lineStat"), charStat=$("charStat"), byteStat=$("byteStat"), dropZone=$("dropZone"), fileInput=$("fileInput");
const fileName=$("fileName"), dirtyMark=$("dirtyMark"), toast=$("toast"), searchBar=$("searchBar"), searchInput=$("searchInput"), searchCount=$("searchCount");

const SAMPLE_JSON={name:"DevTools",version:"3.0.0",description:"A lightweight browser-based JSON utility",features:["format","validate","minify","upload","download","search"],active:true,metadata:{private:true,clientSide:true}};
const buttons={format:$("formatBtn"),minify:$("minifyBtn"),validate:$("validateBtn"),copy:$("copyBtn"),paste:$("pasteBtn"),upload:$("uploadBtn"),download:$("downloadBtn"),sample:$("sampleBtn"),clear:$("clearBtn")};
let currentFile="untitled.json", toastTimer, searchMatches=[];

function showMessage(text="",type=""){message.textContent=text;message.className=`message ${type}`.trim()}
function setStatus(text,type="ready"){status.textContent=text;statusDot.className="status-dot";if(type==="error")statusDot.classList.add("error");if(type==="warning")statusDot.classList.add("warning")}
function notify(text){toast.textContent=text;toast.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove("show"),1800)}
function flashButton(button,text){const original=button.textContent;button.textContent=text;setTimeout(()=>button.textContent=original,900)}
function escapeHTML(text){return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function highlightJSON(value){
  if(!value)return "";
  let html=escapeHTML(value);
  html=html.replace(/("(?:\\.|[^"\\])*")(\s*:)/g,'<span class="json-key">$1</span>$2')
    .replace(/("(?:\\.|[^"\\])*")/g,'<span class="json-string">$1</span>')
    .replace(/\b(true|false)\b/g,'<span class="json-boolean">$1</span>')
    .replace(/\b(null)\b/g,'<span class="json-null">$1</span>')
    .replace(/(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,'<span class="json-number">$1</span>');
  return html;
}
function updatePreview(){previewCode.innerHTML=highlightJSON(jsonInput.value)||" "}
function updateLineNumbers(){const count=Math.max(1,jsonInput.value.split("\n").length);lineNumbers.textContent=Array.from({length:count},(_,i)=>i+1).join("\n");lineStat.textContent=`${count.toLocaleString()} ${count===1?"line":"lines"}`}
function updateStats(){const value=jsonInput.value;const bytes=new Blob([value]).size;charStat.textContent=`${value.length.toLocaleString()} ${value.length===1?"char":"chars"}`;byteStat.textContent=bytes<1024?`${bytes} B`:`${(bytes/1024).toFixed(1)} KB`}
function syncScroll(){jsonPreview.scrollTop=jsonInput.scrollTop;jsonPreview.scrollLeft=jsonInput.scrollLeft;lineNumbers.scrollTop=jsonInput.scrollTop}
function markDirty(){dirtyMark.hidden=!jsonInput.value}
function updateEditor(){updatePreview();updateLineNumbers();updateStats();markDirty();syncScroll();if(searchBar.hidden===false)updateSearch()}
function getErrorLocation(error,value){
  const posMatch=String(error.message).match(/(?:position|at position|at) (\d+)/i);
  if(!posMatch)return null;
  const pos=Number(posMatch[1]),before=value.slice(0,pos),line=before.split("\n").length,column=pos-(before.lastIndexOf("\n")+1)+1;
  return {pos,line,column};
}
function parseJSON(show=true){
  const value=jsonInput.value.trim();
  if(!value){if(show){showMessage("Please enter some JSON first.","error");setStatus("Empty","error")}return null}
  try{return JSON.parse(value)}
  catch(error){
    const loc=getErrorLocation(error,value);
    if(show)showMessage(loc?`Invalid JSON — line ${loc.line}, column ${loc.column}.`:"Invalid JSON. Please check your syntax.","error");
    setStatus("Invalid JSON","error");return null;
  }
}
function setContent(value,name="untitled.json",statusText="Editing"){jsonInput.value=value;currentFile=name;fileName.textContent=name;updateEditor();setStatus(statusText);jsonInput.focus()}
function transform(kind){
  const parsed=parseJSON();if(parsed===null)return;
  jsonInput.value=kind==="minify"?JSON.stringify(parsed):JSON.stringify(parsed,null,2);
  updateEditor();showMessage(`JSON ${kind==="minify"?"minified":"formatted"} successfully.`,"success");setStatus("Valid JSON");notify(kind==="minify"?"JSON minified":"JSON formatted");
}
buttons.format.onclick=()=>transform("format");
buttons.minify.onclick=()=>transform("minify");
buttons.validate.onclick=()=>{
  const parsed=parseJSON();if(parsed===null)return;
  const type=Array.isArray(parsed)?"array":parsed===null?"null":typeof parsed;
  showMessage(`Valid JSON — root type: ${type}.`,"success");setStatus("Valid JSON");notify("JSON is valid");
};
buttons.paste.onclick=async()=>{
  try{const value=await navigator.clipboard.readText();if(!value){showMessage("Clipboard is empty.","warning");return}setContent(value);showMessage("Pasted from clipboard.","success");notify("Pasted from clipboard")}
  catch{showMessage("Clipboard access was blocked. Paste manually with Ctrl + V.","warning")}
};
buttons.copy.onclick=async()=>{
  if(!jsonInput.value.trim()){showMessage("Nothing to copy.","error");return}
  try{await navigator.clipboard.writeText(jsonInput.value);flashButton(buttons.copy,"Copied");showMessage("Copied to clipboard.","success");notify("Copied to clipboard")}
  catch{showMessage("Could not copy the text.","error")}
};
buttons.sample.onclick=()=>{setContent(JSON.stringify(SAMPLE_JSON,null,2));showMessage("Sample JSON loaded.","success");setStatus("Valid JSON");notify("Sample loaded")};
buttons.clear.onclick=()=>{setContent("","untitled.json","Ready");showMessage("");dirtyMark.hidden=true;notify("Editor cleared")};
buttons.upload.onclick=()=>fileInput.click();

function loadFile(file){
  if(!file)return;
  const isJSON=file.type==="application/json"||file.name.toLowerCase().endsWith(".json");
  if(!isJSON){showMessage("Please select a .json file.","error");setStatus("Wrong file type","error");return}
  if(file.size>5*1024*1024){showMessage("File is too large. Maximum size is 5 MB.","error");setStatus("File too large","error");return}
  const reader=new FileReader();
  reader.onload=()=>{setContent(String(reader.result||""),file.name,"File loaded");showMessage(`Loaded ${file.name}.`,"success");notify("JSON file loaded")};
  reader.onerror=()=>{showMessage("Could not read the file.","error");setStatus("Read error","error")};
  reader.readAsText(file);
}
fileInput.onchange=()=>{loadFile(fileInput.files[0]);fileInput.value=""};
["dragenter","dragover"].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.add("dragging")}));
["dragleave","drop"].forEach(type=>dropZone.addEventListener(type,e=>{e.preventDefault();dropZone.classList.remove("dragging")}));
dropZone.ondrop=e=>loadFile(e.dataTransfer.files[0]);

buttons.download.onclick=()=>{
  const parsed=parseJSON();if(parsed===null)return;
  const blob=new Blob([JSON.stringify(parsed,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=currentFile.toLowerCase().endsWith(".json")?currentFile:"formatted.json";document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
  showMessage("JSON downloaded successfully.","success");setStatus("Valid JSON");notify("Download started");
};

jsonInput.addEventListener("input",()=>{updateEditor();if(!jsonInput.value.trim()){showMessage("");setStatus("Ready")}else setStatus("Editing")});
jsonInput.addEventListener("scroll",syncScroll);
jsonInput.addEventListener("keydown",e=>{
  if(e.key==="Tab"){e.preventDefault();const start=jsonInput.selectionStart,end=jsonInput.selectionEnd;jsonInput.setRangeText("  ",start,end,"end");updateEditor();return}
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();buttons.format.click()}
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="m"){e.preventDefault();buttons.minify.click()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="f"){e.preventDefault();openSearch()}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!searchBar.hidden)closeSearch()});

function openSearch(){searchBar.hidden=false;searchInput.focus();updateSearch()}
function closeSearch(){searchBar.hidden=true;searchInput.value="";searchMatches=[];searchCount.textContent="0 matches";jsonInput.focus()}
$("searchBtn").onclick=openSearch;$("searchClose").onclick=closeSearch;
searchInput.addEventListener("input",updateSearch);
function updateSearch(){
  const q=searchInput.value;
  if(!q){searchMatches=[];searchCount.textContent="0 matches";return}
  const value=jsonInput.value.toLowerCase(),needle=q.toLowerCase();let from=0,count=0;
  while((from=value.indexOf(needle,from))!==-1){count++;from+=needle.length||1}
  searchCount.textContent=`${count} ${count===1?"match":"matches"}`;
}
$("wrapBtn").onclick=()=>{
  $("wrapBtn").classList.toggle("active");
  $("editor-wrapper")?.classList.toggle("wrap-off");
  dropZone.classList.toggle("wrap-off");
};

const savedTheme=localStorage.getItem("json-theme");
if(savedTheme==="light")document.documentElement.classList.add("light");
$("themeBtn").onclick=()=>{document.documentElement.classList.toggle("light");localStorage.setItem("json-theme",document.documentElement.classList.contains("light")?"light":"dark");$("themeBtn").textContent=document.documentElement.classList.contains("light")?"☾":"☼"};

updateEditor();
