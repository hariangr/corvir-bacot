function regionCard(label, desc) {
  return `
  <div class="card">
    <div class="card-body">
      <h5 class="card-title">${label}</h5>
      <h6 class="card-subtitle mb-2 text-muted">${desc}</h6>
    </div>
  </div>`;
}

function regionList(label, desc, no) {
  return `
  <div class="card mb-2">
    <div class="card-body">
      <small>${no} <b>${label}</b> <i>${desc}</i></small>
    </div>
  </div>`;
}

function createAutoComplete(
  selector,
  inputSelector,
  outputSelector,
  onSelected
) {
  return new autoComplete({
    selector: selector,
    minChars: 1,
    source: function (term, suggest) {
      term = term.toLowerCase().split(" ");

      var suggestions = [];
      for (const _id of Object.keys(visualizes)) {
        const regionObj = visualizes[_id];
        const h = regionObj["h"];

        for (const regname of h) {
          const found = term.some((v) => regname.toLowerCase().includes(v));
          if (found) {
            suggestions.push(regionObj);
            break;
          }
        }
      }

      suggest(suggestions);
    },
    renderItem: function (item, search) {
      let str = translateArrRegionPathToStr(item["h"]);
      let sub = `Lat ${item["cob"]["latitude"]}; Lng ${item["cob"]["longitude"]}`;

      return `<div class="autocomplete-suggestion" data-str="${str}" data-id="${item["id"]}" data-sub="${sub}">${str}</div>`;
    },
    onSelect: function (e, term, item) {
      const s = item.getAttribute("data-str");
      const id = item.getAttribute("data-id");
      const sub = item.getAttribute("data-sub");

      document.getElementById(inputSelector).value = s;
      onSelected(id);

      document.getElementById(outputSelector).innerHTML = regionCard(s, sub);
    },
  });
}

const asalAC = createAutoComplete(
  "#asalInput",
  "asalInput",
  "asalCardCont",
  (id) => {
    uiSourceId = id;
  }
);
const tujuanAC = createAutoComplete(
  "#tujuanInput",
  "tujuanInput",
  "tujuanCardCont",
  (id) => {
    uiGoalId = id;
  }
);

function translateArrRegionPathToStr(arrRegPath) {
  let str = arrRegPath.reduce((prev, cur, _) => (prev += " > " + cur));
  str = str.replace("Indonesia > ", "");
  return str;
}

let isStarted = false;
let uiSourceId, uiGoalId;
document.getElementById("btnMulai").addEventListener("click", function () {
  const mulaiElem = document.getElementById("btnMulai");

  if (isStarted) {
    // Sedang berjalan, stop
    stopBfsFrame = true;
    mulaiElem.innerText = "Mulai";
    mulaiElem.classList.remove("btn-danger");
    mulaiElem.classList.add("btn-primary");
  } else {
    // Sedang berhenti, mulai
    if (uiSourceId == undefined || uiGoalId == undefined) {
      alert("Asal dan Tujuan tidak boleh kosong!");
      return;
    }

    stopBfsFrame = false;
    newBFS(uiSourceId, uiGoalId);
    mulaiElem.innerText = "Stop";
    mulaiElem.classList.add("btn-danger");
    mulaiElem.classList.remove("btn-primary");
  }
});

document.addEventListener("bfs-finish", (e) => {
  const { traceback } = e.detail;

  const pathElem = document.getElementById("regionPassed");
  pathElem.innerHTML = "";

  let str = "";
  for (let i = traceback.length - 1; i >= 0; i--) {
    const it = traceback[i];
    const regObj = visualizes[it];

    str += regionList(
      translateArrRegionPathToStr(regObj["h"]),
      `Lat ${regObj["cob"]["latitude"]}; Lng ${regObj["cob"]["longitude"]}`,
      traceback.length - i
    );
  }
  pathElem.innerHTML = str;

  // Sudah selesai
  const mulaiElem = document.getElementById("btnMulai");
  stopBfsFrame = true;
  mulaiElem.innerText = "Mulai";
  mulaiElem.classList.remove("btn-danger");
  mulaiElem.classList.add("btn-primary");
});

let showSidebar = true;

document
  .getElementById("hamburgerMenu")
  .addEventListener("click", function onHamburgerClicked() {
    showSidebar = !showSidebar;
    const _sidebar = document.getElementById("sidebarx");

    if (showSidebar) {
      _sidebar.classList.remove("hideLoading");
    } else {
      _sidebar.classList.add("hideLoading");
    }
  });

function setCurrentLocAsAsal() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (latitude == undefined || longitude == undefined) return;

        const cachedDist = Object.keys(visualizes).map((key) => {
          const v = visualizes[key];
          const _cob = v["cob"];
          return {
            dist: haversine(
              [longitude, latitude],
              [_cob["longitude"], _cob["latitude"]]
            ),
            id: v["id"],
          };
        });
        const sorted = cachedDist.sort((a, b) => {
          return a["dist"] - b["dist"];
        });
        const closestObj = visualizes[sorted[0]["id"]];

        // Hanya set ke default (Lokasi saat ini) apabila user belum memilih manual
        if (uiSourceId == undefined) {
          const str = translateArrRegionPathToStr(closestObj["h"]);
          const sub = `Lat ${closestObj["cob"]["latitude"]}; Lng ${closestObj["cob"]["longitude"]}`;

          document.getElementById("asalInput").value = str;
          document.getElementById("asalCardCont").innerHTML = regionCard(
            str,
            sub
          );
          uiSourceId = closestObj["id"];
        }
      },
      (error) => {
        // Do nothing
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }
}
/* CURRENT USER LOCATION */
document.onreadystatechange = function () {
  if (uiSourceId != undefined || uiGoalId != undefined) return;

  if (document.readyState == "complete") {
    if (visualizes != undefined) {
      setCurrentLocAsAsal();
    } else {
      setTimeout(setCurrentLocAsAsal, 1500);
    }
  } else {
    // Do nothing
  }
};
