import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

let gUserPos;

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onDialogSave
}

function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="inner">
                <div class="loc-item-state"><img src="./img/spinner.svg"></div>
                <div class="loc-btns">     
                    <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
                    <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
                    <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
                </div>
            </div>
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    locService.getById(locId)
        .then(({ name }) => {
            if (confirm(`Delete ${name}?`)) {
                const locItemStateEl = document.querySelector('.loc-item-state');
                locItemStateEl.classList.add('loading');
                locService.remove(locId)
                    .then(() => {
                        flashMsg('Location removed')
                        unDisplayLoc()
                        loadAndRenderLocs()
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot remove location')
                    }).finally(() => {
                        locItemStateEl.classList.remove('loading');
                    });
            }
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {

    const
        dialogEl = document.querySelector('.manage-loc-dialog'),
        dialogAddressEl = dialogEl.querySelector('.loc-address-input'),
        dialogRateEl = dialogEl.querySelector('.loc-rate-input');

    dialogEl.dataset.editMode = 'add-new';
    dialogEl.dataset.clickedGeo = JSON.stringify(geo);

    dialogAddressEl.value = geo.address;
    dialogRateEl.value = 3;

    dialogAddressEl.disabled = false;

    dialogEl.showModal();

}

function loadAndRenderLocs() {
    locService.query()
        .then(locs => {
            renderLocs(locs);
            updateUserPos();
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            const
                dialogEl = document.querySelector('.manage-loc-dialog'),
                dialogAddressEl = dialogEl.querySelector('.loc-address-input'),
                dialogRateEl = dialogEl.querySelector('.loc-rate-input');

            dialogEl.dataset.editLocId = locId;
            dialogEl.dataset.editMode = 'edit-rate';

            dialogAddressEl.value = loc.geo.address;
            dialogAddressEl.disabled = true;

            dialogRateEl.value = loc.rate;

            dialogEl.showModal();
        })
}

function onDialogSave() {

    const
        dialogEl = document.querySelector('.manage-loc-dialog'),
        dialogAddressEl = dialogEl.querySelector('.loc-address-input'),
        dialogRateEl = dialogEl.querySelector('.loc-rate-input'),
        editMode = dialogEl.dataset.editMode;

    if (editMode === 'add-new') {
        locService.save({
            name: dialogAddressEl.value,
            rate: dialogRateEl.value,
            geo: JSON.parse(dialogEl.dataset.clickedGeo)
        })
            .then(savedLoc => {
                flashMsg(`Added Location (id: ${savedLoc.id})`)
                loadAndRenderLocs();
            })
            .catch(err => {
                console.error('OOPs:', err)
                flashMsg('Cannot add location');
            })
            .finally(() => {
                dialogEl.removeAttribute('data-edit-loc-id');
                dialogEl.removeAttribute('data-edit-mode');
                dialogEl.removeAttribute('data-clicked-geo');
            });
    } else if (editMode === 'edit-rate') {
        locService.getById(dialogEl.dataset.editLocId)
            .then(loc => {
                loc.rate = dialogRateEl.value;
                locService.save(loc)
                    .then(savedLoc => {
                        flashMsg(`Rate was set to: ${savedLoc.rate}`)
                        loadAndRenderLocs();
                    })
                    .catch(err => {
                        console.error('OOPs:', err)
                        flashMsg('Cannot update rate')
                    })
                    .finally(() => {
                        dialogEl.removeAttribute('data-edit-loc-id');
                        dialogEl.removeAttribute('data-edit-mode');
                    });
            });
    }

}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {

    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    utilService.updateQueryParams({ locId: loc.id })

    const
        el = document.querySelector('.selected-loc'),
        distanceFromUserLabel = document.querySelector(`[data-id="${getLocIdFromQueryParams()}"] .distance-from-user`)?.textContent;

    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.distance-from-user').innerHTML = distanceFromUserLabel || '';
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    Promise.all([
        locService.getLocCountByRateMap(),
        locService.getLocCountByLastUpdated()
    ]).then(stats => {
        console.log(stats);
        handleStats(stats[0], 'loc-stats-rate');
        handleStats(stats[1], 'loc-stats-last-updated');
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}

function updateUserPos() {
    mapService.getUserPosition()
        .then(pos => {
            gUserPos = pos;
            _renderDistancesFromUserPos();
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function _renderDistancesFromUserPos() {
    locService.query()
        .then(locs => {
            locs.forEach(loc => {
                document.querySelector(`[data-id="${loc.id}"] h4 span:first-child`)
                    .insertAdjacentHTML('afterend', `<span class='distance-from-user'>${loc.geo?.lat ? utilService.getDistance(loc.geo, gUserPos, 'K') : '???'} km from me</span>`);
            });
            if (getLocIdFromQueryParams()) document.querySelector('.selected-loc .distance-from-user').innerHTML = document.querySelector(`[data-id='${getLocIdFromQueryParams()}'] .distance-from-user`).textContent;
        });
}