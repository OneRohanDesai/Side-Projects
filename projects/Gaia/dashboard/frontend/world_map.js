var map = L.map('map').setView([20, 0], 2)

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
    maxZoom: 5
}).addTo(map)

let countryLayers = {}

async function loadCountries(){

    let res = await fetch(
        "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json"
    )

    let geo = await res.json()

    L.geoJSON(geo, {

        style: {
            color: "#555",
            weight: 1,
            fillColor: "#ccc",
            fillOpacity: 0.3
        },

        onEachFeature: function(feature, layer){

            let name = feature.properties.name.toLowerCase()

            countryLayers[name] = layer

            layer.on("click", function(){
                selectCountry(name)
            })

        }

    }).addTo(map)

    highlightActiveCountries()

}

function selectCountry(name){

    document.getElementById("country").value = name
    document.getElementById("panel-country").innerText = name

    loadCountryStatus(name)
    loadCountryLogs(name)

}

async function highlightActiveCountries(){

    let res = await fetch("http://localhost:9000/countries")
    let countries = await res.json()

    countries.forEach(c => {

        let name = c.country.toLowerCase()

        let layer = countryLayers[name]

        if(!layer) return

        if(c.status === "Running"){

            layer.setStyle({
                fillColor: "green",
                fillOpacity: 0.6
            })

        }
        else if(c.status === "offline"){

            layer.setStyle({
                fillColor: "gray",
                fillOpacity: 0.4
            })

        }
        else{

            layer.setStyle({
                fillColor: "red",
                fillOpacity: 0.6
            })

        }

    })

}

async function loadCountryStatus(name){

    let res = await fetch("http://localhost:9000/countries")
    let countries = await res.json()

    let match = countries.find(c => c.country === name)

    if(match){

        document.getElementById("panel-status").innerText = match.status

    }

}

function restartCountry(){

    let country = document.getElementById("panel-country").innerText

    console.log("Restart requested:", country)

}

function pauseCountry(){

    let country = document.getElementById("panel-country").innerText

    console.log("Pause requested:", country)

}

function openEventPanel(){

    let country = document.getElementById("panel-country").innerText

    document.getElementById("country").value = country

    window.scrollTo(0,0)

}

async function loadCountryLogs(country){

    let res = await fetch(
        "http://localhost:9000/countries/" + country + "/logs"
    )

    let data = await res.json()

    let html = ""

    data.logs.forEach(line => {

        html += line + "<br>"

    })

    document.getElementById("country-logs").innerHTML = html

}

let lastEventTime = null

async function watchEvents(){

    let res = await fetch("http://localhost:9000/events/latest")

    let event = await res.json()

    if(!event.time) return

    if(event.time !== lastEventTime){

        lastEventTime = event.time

        console.log("New event:", event)

        flashCountry(event.country)

        alert(
            "EVENT: " + event.event +
            "\nCOUNTRY: " + event.country +
            "\nINTENSITY: " + event.intensity
        )

    }

}

function flashCountry(country){

    let layer = countryLayers[country]

    if(!layer) return

    let original = {
        fillColor: layer.options.fillColor,
        fillOpacity: layer.options.fillOpacity
    }

    layer.setStyle({ fillColor:"red", fillOpacity:1 })

    setTimeout(()=>layer.setStyle(original), 400)
    setTimeout(()=>layer.setStyle({ fillColor:"red", fillOpacity:1 }), 800)
    setTimeout(()=>layer.setStyle(original), 1200)

}

setInterval(function(){
    let country = document.getElementById("panel-country").innerText
    if(country !== "None"){
        loadCountryLogs(country)
    }
}, 2000)

setInterval(highlightActiveCountries, 5000)
setInterval(watchEvents, 2000)
loadCountries()
