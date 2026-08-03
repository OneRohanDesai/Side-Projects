const API="http://localhost:9000"

async function loadClusters(){

const res=await fetch(API+"/clusters")
const clusters=await res.json()

const el=document.getElementById("clusters")
el.innerHTML=""

clusters.forEach(c=>{

const div=document.createElement("div")
div.className="item"

div.innerHTML=`
${c.name}
<span>${c.status}</span>
`

el.appendChild(div)

})

}

async function loadCountries(){

const res=await fetch(API+"/countries")
const countries=await res.json()

const list=document.getElementById("countries")
list.innerHTML=""

const select=document.getElementById("country")
select.innerHTML=""

countries.forEach(c=>{

const div=document.createElement("div")
div.className="item"

div.innerHTML=`
${c.country}
<span>${c.status}</span>
`

div.onclick=()=>loadCountryLogs(c.country)

list.appendChild(div)

const opt=document.createElement("option")
opt.value=c.country
opt.textContent=c.country
select.appendChild(opt)

})

}

async function loadEvents(){

const res=await fetch(API+"/events")
const events=await res.json()

const el=document.getElementById("event")
el.innerHTML=""

events.forEach(e=>{
const opt=document.createElement("option")
opt.value=e
opt.textContent=e
el.appendChild(opt)
})

}

async function loadEventLog(){

const res=await fetch(API+"/events/log")
const logs=await res.json()

const el=document.getElementById("event-log")
el.innerHTML=""

logs.reverse().forEach(l=>{

const div=document.createElement("div")

div.textContent=`${l.time} | ${l.country} | ${l.event}`

el.appendChild(div)

})

}

async function executeEvent(){

const event=document.getElementById("event").value
const country=document.getElementById("country").value
const intensity=parseFloat(document.getElementById("intensity").value)

await fetch(API+"/events/trigger",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({event,country,intensity})
})

loadEventLog()

}

async function loadCountryLogs(country){

const res=await fetch(API+`/countries/${country}/logs`)
const data=await res.json()

const el=document.getElementById("country-logs")
el.innerHTML=""

data.logs.forEach(l=>{

const div=document.createElement("div")
div.textContent=l
el.appendChild(div)

})

}

function showTab(id){

document.querySelectorAll(".tab").forEach(t=>{
t.classList.remove("active")
})

document.getElementById(id).classList.add("active")

}

showTab("overview")

loadClusters()
loadCountries()
loadEvents()
loadEventLog()

setInterval(loadEventLog,5000)