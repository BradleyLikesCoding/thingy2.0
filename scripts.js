var lazyLoad = new LazyLoad();

var gamesJson = [];
var searchedGamesJson = [];
var currentPage = 0;

var gamesDiv = document.getElementById("games-container")

const pageSize = 50;

function showLoading() {
    document.getElementsByClassName("loading-cover")[0].style.display = "flex";
}

function hideLoading() {
    document.getElementsByClassName("loading-cover")[0].style.display = "none";
}

function throwError(error) {
    alert(error);
}

async function openGame(gameURL) {
    showLoading();
    try {
        window.open("./load?id=" + gameURL);
    } catch (err) {
        throwError("Error Opening Game: " + err.message);
    }
    hideLoading();
}

async function loadGames() {
    const res = await getCDNS("games.json", true);
    if (!res.ok) throw new Error("Failed to fetch games list");
    const games = await res.json();
    gamesJson = games;
    searchedGamesJson = gamesJson;
    currentPage = 0;
    setPageArrows();
    setGames(0);
}

async function getGameHTML(game) {
    return (`
  <div class="game" onclick="openGame('${game["link"].slice(9).replace(/index\.html$/, '')}')">
    <div class="game-image-container">
      <img class="game-image lazy" src="${await getCDNS(game["imgSrc"].slice(9), false, true)}">
    </div>
    <p class="game-title">
      ${game["title"]}
    </p>
  </div>
  `);
}

async function setGames(page) {
    var html = '<div class="game-row">';
    for (var i = page * pageSize; i < searchedGamesJson.length; i++) {
        html += await getGameHTML(searchedGamesJson[i]);
        if (((1 + i) - (page * pageSize)) % 5 == 0) html += '</div><div class="game-row">';
        if (i - (page * pageSize) == pageSize - 1) break;
    }
    gamesDiv.innerHTML = html + '</div>';
    if (!gamesDiv.childNodes[gamesDiv.childNodes.length - 1].hasChildNodes()) gamesDiv.childNodes[gamesDiv.childNodes.length - 1].remove();
    lazyLoad.update();
    scrollToTopOfGames();
}

function searchGames(e) {
    currentPage = 0;
    setPageArrows();
    games = []
    for (var i = 0; i < gamesJson.length; i++) {
        if (gamesJson[i]["title"].toLowerCase().search(e.value.toLowerCase()) != -1) games.push(gamesJson[i]);
    }
    searchedGamesJson = games;
    setPageArrows();
    setGames(currentPage);
}

function setPageArrows() {
    var maxPage = getPageCount() - 1;
    if (currentPage < 0) currentPage = 0;
    if (currentPage > maxPage) currentPage = maxPage;
    var pageNumbers = document.getElementsByClassName("page-number");
    pageNumbers[0].innerHTML = currentPage + 1;
    pageNumbers[1].innerHTML = currentPage + 1;
    var btns = document.getElementsByClassName("switch-page");
    if (currentPage == 0) { btns[0].style.visibility = "hidden"; btns[2].style.visibility = "hidden" } else { btns[0].style.visibility = "visible"; btns[2].style.visibility = "visible" };
    if (currentPage == maxPage) { btns[1].style.visibility = "hidden"; btns[3].style.visibility = "hidden" } else { btns[1].style.visibility = "visible"; btns[3].style.visibility = "visible" };
}

function getPageCount() {
    return Math.ceil(searchedGamesJson.length / pageSize);
}

function scrollToTopOfGames() {
    document.querySelector("main").scroll({ top: 0, left: 0, behavior: "instant" });
}

async function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register("./sw.js", { scope: './' })
            .then(async reg => {
                console.log('SW registered:', reg.scope);
                await navigator.serviceWorker.ready;

                if (!navigator.serviceWorker.controller) {
                    location.reload();
                }
            })
            .catch(err => console.error('SW registration failed:', err));
    }
}

registerSW();
loadGames();