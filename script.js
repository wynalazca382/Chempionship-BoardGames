// Stan aplikacji
let tournament = {
    gameName: '',
    players: [],
    currentRound: 0,
    totalRounds: 2,
    preferredTableSize: 4,
    rounds: [],
    totalTournamentPoints: {},
    totalGamePoints: {},
    firstPlaces: {},
    highestSingleScore: {},
    totalTieBreakers: {},
    totalTieBreakersByIndex: {}
};

const TIE_BREAKER_COUNT = 3;

// --- FUNKCJE POMOCNICZE ---

function createRounds(totalRounds) {
    return Array.from({ length: totalRounds }, () => ({
        tables: [],
        scores: {},
        tieBreakers: {},
        tournamentPoints: {}
    }));
}

function normalizeTieBreakers(tieBreakers) {
    const normalized = Array.isArray(tieBreakers) ? [...tieBreakers] : [];
    while (normalized.length < TIE_BREAKER_COUNT) normalized.push(0);
    return normalized.slice(0, TIE_BREAKER_COUNT);
}

function compareTieBreakers(a, b) {
    for (let i = 0; i < TIE_BREAKER_COUNT; i++) {
        const diff = (b[i] || 0) - (a[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function readTournamentConfig() {
    const roundInput = document.getElementById('round-count');
    const tableSizeInput = document.getElementById('preferred-table-size');

    const rounds = Math.max(1, Math.min(10, parseInt(roundInput?.value, 10) || 2));
    const preferredSize = Math.max(3, Math.min(8, parseInt(tableSizeInput?.value, 10) || 4));

    tournament.totalRounds = rounds;
    tournament.preferredTableSize = preferredSize;
}

// --- LOGIKA WYBORU GRY I GRACZY ---

function selectGame() {
    const gameInput = document.getElementById('game-name');
    const gameName = gameInput.value.trim();
    
    if (!gameName) {
        alert('Wprowadź nazwę gry!');
        return;
    }
    
    tournament.gameName = gameName;
    readTournamentConfig();
    
    document.getElementById('selected-game').innerHTML = `
        <strong>Wybrana gra:</strong> ${tournament.gameName}<br>
        <span style="color:#667eea; font-weight: 500;">Rundy: ${tournament.totalRounds} · Preferowany stół: ${tournament.preferredTableSize} osoby</span>
    `;
    
    document.getElementById('player-section').classList.add('active');
    gameInput.value = '';
}

function addPlayer() {
    const playerInput = document.getElementById('player-name');
    const playerName = playerInput.value.trim();
    
    if (!playerName) {
        alert('Wprowadź imię gracza!');
        return;
    }
    
    if (tournament.players.includes(playerName)) {
        alert('Gracz o tym imieniu już istnieje!');
        return;
    }
    
    tournament.players.push(playerName);
    playerInput.value = '';
    updatePlayerList();
}

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    
    if (tournament.players.length === 0) {
        playerList.innerHTML = '<p style="color: #999;">Brak graczy. Dodaj pierwszego gracza.</p>';
        document.getElementById('generate-tables-btn').style.display = 'none';
        return;
    }
    
    playerList.className = 'player-list';
    playerList.innerHTML = tournament.players.map((player, index) => `
        <div class="player-item">
            <span>${player}</span>
            <button onclick="removePlayer(${index})">Usuń</button>
        </div>
    `).join('');
    
    document.getElementById('generate-tables-btn').style.display = 'block';
}

function removePlayer(index) {
    tournament.players.splice(index, 1);
    updatePlayerList();
}

// --- GENEROWANIE I EDYCJA STOŁÓW ---

function generateTables() {
    if (tournament.players.length < 3) {
        alert('Potrzebujesz co najmniej 3 graczy!');
        return;
    }

    readTournamentConfig();
    tournament.rounds = createRounds(tournament.totalRounds);
    tournament.totalTournamentPoints = {};
    tournament.totalGamePoints = {};
    tournament.firstPlaces = {};
    tournament.highestSingleScore = {};
    tournament.totalTieBreakers = {};
    
    tournament.currentRound = 0;
    generateRoundTables(0);
    
    displayTables();
    document.getElementById('tables-section').classList.add('active');
    document.getElementById('start-scoring-btn').style.display = 'block';
}

function generateRoundTables(roundIndex) {
    let shuffledPlayers;
    if (roundIndex === 0) {
        shuffledPlayers = [...tournament.players].sort(() => Math.random() - 0.5);
    } else {
        shuffledPlayers = generateNonRepeatingTables();
    }
    
    tournament.rounds[roundIndex].tables = [];
    const totalPlayers = shuffledPlayers.length;
    const tableSizes = calculateTableStructure(totalPlayers, tournament.preferredTableSize);
    let tableNumber = 1;
    let currentIndex = 0;

    tableSizes.forEach(size => {
        const tablePlayers = shuffledPlayers.slice(currentIndex, currentIndex + size);
        tournament.rounds[roundIndex].tables.push({
            tableNumber: tableNumber++,
            players: tablePlayers
        });
        currentIndex += size;
    });
}

function calculateTableStructure(totalPlayers, preferredSize) {
    const minTableSize = 3;
    const safePreferred = Math.max(minTableSize, preferredSize);
    let tableCount = Math.ceil(totalPlayers / safePreferred);
    let baseSize = Math.floor(totalPlayers / tableCount);

    while (baseSize < minTableSize && tableCount > 1) {
        tableCount -= 1;
        baseSize = Math.floor(totalPlayers / tableCount);
    }

    const remainder = totalPlayers % tableCount;
    return Array.from({ length: tableCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function generateNonRepeatingTables() {
    const previousRoundPairs = new Set();
    tournament.rounds.slice(0, tournament.currentRound).forEach(round => {
        round.tables.forEach(table => {
            for (let i = 0; i < table.players.length; i++) {
                for (let j = i + 1; j < table.players.length; j++) {
                    const pair = [table.players[i], table.players[j]].sort().join('|');
                    previousRoundPairs.add(pair);
                }
            }
        });
    });
    
    const tableStructure = calculateTableStructure(tournament.players.length, tournament.preferredTableSize);
    let bestArrangement = null;
    let minRepeats = Infinity;
    
    for (let attempt = 0; attempt < 100; attempt++) {
        const shuffled = [...tournament.players].sort(() => Math.random() - 0.5);
        let repeats = 0;
        let currentIndex = 0;
        
        for (const tableSize of tableStructure) {
            const tablePlayers = shuffled.slice(currentIndex, currentIndex + tableSize);
            for (let j = 0; j < tablePlayers.length; j++) {
                for (let k = j + 1; k < tablePlayers.length; k++) {
                    const pair = [tablePlayers[j], tablePlayers[k]].sort().join('|');
                    if (previousRoundPairs.has(pair)) repeats++;
                }
            }
            currentIndex += tableSize;
        }
        
        if (repeats < minRepeats) {
            minRepeats = repeats;
            bestArrangement = shuffled;
        }
        if (repeats === 0) break;
    }
    return bestArrangement || [...tournament.players].sort(() => Math.random() - 0.5);
}

// NOWA FUNKCJA: Wyświetlanie z opcją ręcznej zmiany stołu
function displayTables() {
    const tablesDisplay = document.getElementById('tables-display');
    const currentRound = tournament.rounds[tournament.currentRound];
    const allTables = currentRound.tables;
    
    tablesDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 15px;">Runda ${tournament.currentRound + 1}/${tournament.totalRounds}</h3>
        <p style="font-size: 0.9em; color: #666; margin-bottom: 15px; background: #fffde7; padding: 10px; border-radius: 8px; border: 1px solid #ffe58f;">
            💡 <strong>Ręczna edycja:</strong> Wybierz stół obok gracza, aby go przenieść.
        </p>
        ${allTables.map(table => `
            <div class="table">
                <h3>Stół ${table.tableNumber}</h3>
                <div class="table-players">
                    ${table.players.map(player => `
                        <div class="table-player" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; background: white; padding: 8px; border-radius: 6px; border-left: 3px solid #667eea;">
                            <span>${player}</span>
                            <select onchange="movePlayerToTable('${player}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px; cursor: pointer;">
                                ${allTables.map(t => `
                                    <option value="${t.tableNumber}" ${t.tableNumber === table.tableNumber ? 'selected' : ''}>
                                        Stół ${t.tableNumber}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                    ${table.players.length === 0 ? '<p style="color: #ccc; font-style: italic;">Stół pusty</p>' : ''}
                </div>
            </div>
        `).join('')}
    `;
}

// NOWA FUNKCJA: Logika przenoszenia gracza
function movePlayerToTable(playerName, newTableNumber) {
    newTableNumber = parseInt(newTableNumber, 10);
    const currentRound = tournament.rounds[tournament.currentRound];
    
    currentRound.tables.forEach(table => {
        table.players = table.players.filter(p => p !== playerName);
    });
    
    const targetTable = currentRound.tables.find(t => t.tableNumber === newTableNumber);
    if (targetTable) {
        targetTable.players.push(playerName);
    }
    displayTables();
}

function regenerateTables() {
    generateRoundTables(tournament.currentRound);
    displayTables();
}

// --- PUNKTACJA ---

function startScoring() {
    displayScoringSection();
    document.getElementById('scoring-section').classList.add('active');
    const finishBtn = document.getElementById('finish-btn');
    finishBtn.style.display = 'block';
    finishBtn.textContent = tournament.currentRound < tournament.totalRounds - 1 ? 'Następna Runda' : 'Zakończ Turniej';
}

function displayScoringSection() {
    const scoringDisplay = document.getElementById('scoring-display');
    const currentRound = tournament.rounds[tournament.currentRound];

    currentRound.tables.forEach(table => {
        table.players.forEach(player => {
            if (currentRound.scores[player] === undefined) currentRound.scores[player] = 0;
            currentRound.tieBreakers[player] = normalizeTieBreakers(currentRound.tieBreakers[player]);
        });
    });
    
    scoringDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 20px;">Runda ${tournament.currentRound + 1} - Wyniki</h3>
        ${currentRound.tables.map(table => table.players.length > 0 ? `
            <div class="scoring-table">
                <h3>Stół ${table.tableNumber}</h3>
                ${table.players.map(player => `
                    <div class="score-input-group">
                        <label>${player}:</label>
                        <input type="number" onchange="updateScore('${player}', this.value)" value="${currentRound.scores[player]}" placeholder="Pkt">
                        <input type="number" onchange="updateTieBreaker('${player}', 0, this.value)" value="${currentRound.tieBreakers[player][0]}" placeholder="TB1">
                        <input type="number" onchange="updateTieBreaker('${player}', 1, this.value)" value="${currentRound.tieBreakers[player][1]}" placeholder="TB2">
                        <input type="number" onchange="updateTieBreaker('${player}', 2, this.value)" value="${currentRound.tieBreakers[player][2]}" placeholder="TB3">
                        <span id="tournament-points-${tournament.currentRound}-${player}" style="color: #764ba2; font-weight: bold; min-width: 60px;"></span>
                    </div>
                `).join('')}
                <button onclick="calculateTablePoints(${table.tableNumber - 1})" style="margin-top: 10px; width: 100%;">Zatwierdź Stół</button>
            </div>
        ` : '').join('')}
    `;
}

function updateScore(player, score) {
    tournament.rounds[tournament.currentRound].scores[player] = parseInt(score) || 0;
}

function updateTieBreaker(player, index, value) {
    const currentRound = tournament.rounds[tournament.currentRound];
    currentRound.tieBreakers[player] = normalizeTieBreakers(currentRound.tieBreakers[player]);
    currentRound.tieBreakers[player][index] = parseInt(value) || 0;
}

function calculateTablePoints(tableIndex) {
    const currentRound = tournament.rounds[tournament.currentRound];
    const table = currentRound.tables[tableIndex];
    
    const sortedPlayers = [...table.players].sort((a, b) => {
        const scoreDiff = currentRound.scores[b] - currentRound.scores[a];
        if (scoreDiff !== 0) return scoreDiff;
        return compareTieBreakers(normalizeTieBreakers(currentRound.tieBreakers[a]), normalizeTieBreakers(currentRound.tieBreakers[b]));
    });
    
    const pointsMap = [3, 2, 1, 0];
    sortedPlayers.forEach((player, index) => {
        const pts = pointsMap[index] || 0;
        currentRound.tournamentPoints[player] = pts;
        const display = document.getElementById(`tournament-points-${tournament.currentRound}-${player}`);
        if (display) display.textContent = `→ ${pts} PT`;
    });
}

// --- PODSUMOWANIE I RESET ---

function finishTournament() {
    const currentRound = tournament.rounds[tournament.currentRound];
    const allCalculated = tournament.players.every(p => currentRound.tournamentPoints[p] !== undefined);
    
    if (!allCalculated) {
        alert('Zatwierdź wyniki dla wszystkich stołów!');
        return;
    }
    
    if (tournament.currentRound < tournament.totalRounds - 1) {
        tournament.currentRound += 1;
        generateRoundTables(tournament.currentRound);
        displayTables();
        document.getElementById('scoring-section').classList.remove('active');
        document.getElementById('start-scoring-btn').style.display = 'block';
    } else {
        calculateFinalResults();
        displaySummary();
        document.getElementById('summary-section').classList.add('active');
    }
}

function calculateFinalResults() {
    tournament.players.forEach(p => {
        tournament.totalTournamentPoints[p] = 0;
        tournament.totalGamePoints[p] = 0;
        tournament.firstPlaces[p] = 0;
        tournament.highestSingleScore[p] = 0;
        tournament.totalTieBreakers[p] = 0;
        tournament.totalTieBreakersByIndex[p] = [0, 0, 0];

        tournament.rounds.forEach(r => {
            const gp = r.scores[p] || 0;
            const tp = r.tournamentPoints[p] || 0;
            const tbs = normalizeTieBreakers(r.tieBreakers[p]);
            
            tournament.totalTournamentPoints[p] += tp;
            tournament.totalGamePoints[p] += gp;
            tournament.totalTieBreakers[p] += tbs.reduce((a, b) => a + b, 0);
            tbs.forEach((v, i) => tournament.totalTieBreakersByIndex[p][i] += v);
            if (tp === 3) tournament.firstPlaces[p]++;
            if (gp > tournament.highestSingleScore[p]) tournament.highestSingleScore[p] = gp;
        });
    });
}

function displaySummary() {
    const summaryDisplay = document.getElementById('summary-display');
    const sorted = [...tournament.players].map(p => ({
        name: p,
        tp: tournament.totalTournamentPoints[p],
        wins: tournament.firstPlaces[p],
        gp: tournament.totalGamePoints[p],
        high: tournament.highestSingleScore[p],
        tbi: tournament.totalTieBreakersByIndex[p],
        tbs: tournament.totalTieBreakers[p]
    })).sort((a, b) => b.tp - a.tp || b.wins - a.wins || b.gp - a.gp || b.high - a.high || compareTieBreakers(a.tbi, b.tbi));

    summaryDisplay.innerHTML = `
        <table class="summary-table">
            <thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>W</th><th>Pkt Gry</th><th>Suma TB</th></tr></thead>
            <tbody>
                ${sorted.map((p, i) => `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                    <td>${i + 1}</td><td>${p.name}</td><td>${p.tp}</td><td>${p.wins}</td><td>${p.gp}</td><td>${p.tbs}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

function resetTournament() {
    if (confirm('Nowy turniej?')) location.reload();
}

// Start
readTournamentConfig();
updatePlayerList();
