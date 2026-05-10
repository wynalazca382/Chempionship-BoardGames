// Stan aplikacji
let tournament = {
    gameName: '',
    players: [],
    currentRound: 0,
    totalRounds: 2,
    preferredTableSize: 4,
    activeSection: 'game-selection',
    league: {
        enabled: false,
        totalWeeks: 1,
        currentWeek: 0,
        weekSummaries: [],
        weekAttendanceByWeek: {},
        phase: 'inactive'
    },
    rounds: [],
    totalTournamentPoints: {},
    totalGamePoints: {},
    firstPlaces: {},
    highestSingleScore: {},
    totalTieBreakers: {},
    totalTieBreakersByIndex: {}
};

const TIE_BREAKER_COUNT = 3;
const TOURNAMENT_STORAGE_KEY = 'chempionship-boardgames-tournament';

function createLeagueState() {
    return {
        enabled: false,
        totalWeeks: 1,
        currentWeek: 0,
        weekSummaries: [],
        weekAttendanceByWeek: {},
        phase: 'inactive'
    };
}

function isLeagueMode() {
    return Boolean(tournament.league && tournament.league.enabled && tournament.league.totalWeeks > 1);
}

function readLeagueConfig() {
    const leagueModeInput = document.getElementById('league-mode');
    const leagueWeeksInput = document.getElementById('league-weeks');
    const enabled = Boolean(leagueModeInput?.checked);
    const totalWeeks = enabled ? Math.max(2, Math.min(52, parseInt(leagueWeeksInput?.value, 10) || 2)) : 1;

    if (!tournament.league) {
        tournament.league = createLeagueState();
    }

    tournament.league.enabled = enabled;
    tournament.league.totalWeeks = totalWeeks;
    tournament.league.currentWeek = Math.max(0, Math.min(tournament.league.currentWeek || 0, totalWeeks - 1));
    tournament.league.phase = enabled ? (tournament.league.phase === 'inactive' ? 'running' : tournament.league.phase) : 'inactive';

    if (!enabled) {
        tournament.league.weekSummaries = [];
        tournament.league.weekAttendanceByWeek = {};
        tournament.league.currentWeek = 0;
    }
}

function getLeagueWeekLabel() {
    return isLeagueMode() ? ` · Tydzień ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks}` : '';
}

function renderSelectedGameSummary() {
    if (!tournament.gameName) return '';

    const presentCount = getPresentPlayersForCurrentWeek().length;
    const totalPlayers = tournament.players.length;

    const leagueLine = isLeagueMode()
        ? `<br><span style="color:#1f2937; font-weight: 500;">Liga: ${tournament.league.totalWeeks} tygodni · Aktualny tydzień: ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks} · Obecni: ${presentCount}/${totalPlayers}</span>`
        : '';

    return `
        <strong>Wybrana gra:</strong> ${tournament.gameName}<br>
        <span style="color:#667eea; font-weight: 500;">Rundy: ${tournament.totalRounds} · Preferowany stół: ${tournament.preferredTableSize} osoby</span>${leagueLine}
    `;
}

function buildSummaryEntries(summarySource) {
    return [...tournament.players].map(player => ({
        name: player,
        tp: summarySource.totalTournamentPoints[player] || 0,
        wins: summarySource.firstPlaces[player] || 0,
        gp: summarySource.totalGamePoints[player] || 0,
        high: summarySource.highestSingleScore[player] || 0,
        tbi: summarySource.totalTieBreakersByIndex[player] || [0, 0, 0],
        tbs: summarySource.totalTieBreakers[player] || 0
    })).sort((a, b) => b.tp - a.tp || b.wins - a.wins || b.gp - a.gp || b.high - a.high || compareTieBreakers(a.tbi, b.tbi));
}

function renderSummaryBlock(title, subtitle, entries) {
    return `
        <h3 style="color: #764ba2; margin-bottom: 12px;">${title}</h3>
        ${subtitle ? `<p style="margin-bottom: 16px; color: #666;">${subtitle}</p>` : ''}
        <table class="summary-table">
            <thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>W</th><th>Pkt Gry</th><th>Suma TB</th></tr></thead>
            <tbody>
                ${entries.map((p, i) => `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                    <td>${i + 1}</td><td>${p.name}</td><td>${p.tp}</td><td>${p.wins}</td><td>${p.gp}</td><td>${p.tbs}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

function renderLeagueBalanceBlock(summarySource) {
    const entries = buildSummaryEntries(summarySource);

    return `
        <div class="league-balance-panel">
            <h3 style="color: #764ba2; margin-bottom: 12px;">Bilans ligi</h3>
            <p style="margin-bottom: 16px; color: #666;">Zestawienie całej ligi po wszystkich tygodniach.</p>
            <table class="summary-table league-balance-table">
                <thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>W</th><th>Pkt Gry</th><th>Suma TB</th></tr></thead>
                <tbody>
                    ${entries.map((p, i) => `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                        <td>${i + 1}</td><td>${p.name}</td><td>${p.tp}</td><td>${p.wins}</td><td>${p.gp}</td><td>${p.tbs}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function captureCurrentWeekSummary() {
    return {
        weekNumber: tournament.league.currentWeek + 1,
        totalTournamentPoints: JSON.parse(JSON.stringify(tournament.totalTournamentPoints)),
        totalGamePoints: JSON.parse(JSON.stringify(tournament.totalGamePoints)),
        firstPlaces: JSON.parse(JSON.stringify(tournament.firstPlaces)),
        highestSingleScore: JSON.parse(JSON.stringify(tournament.highestSingleScore)),
        totalTieBreakers: JSON.parse(JSON.stringify(tournament.totalTieBreakers)),
        totalTieBreakersByIndex: JSON.parse(JSON.stringify(tournament.totalTieBreakersByIndex))
    };
}

function buildLeagueAggregateSummary() {
    const aggregate = {
        totalTournamentPoints: {},
        totalGamePoints: {},
        firstPlaces: {},
        highestSingleScore: {},
        totalTieBreakers: {},
        totalTieBreakersByIndex: {}
    };

    tournament.players.forEach(player => {
        aggregate.totalTournamentPoints[player] = 0;
        aggregate.totalGamePoints[player] = 0;
        aggregate.firstPlaces[player] = 0;
        aggregate.highestSingleScore[player] = 0;
        aggregate.totalTieBreakers[player] = 0;
        aggregate.totalTieBreakersByIndex[player] = [0, 0, 0];
    });

    (tournament.league?.weekSummaries || []).forEach(weekSummary => {
        tournament.players.forEach(player => {
            const tournamentPoints = weekSummary?.totalTournamentPoints?.[player] || 0;
            const gamePoints = weekSummary?.totalGamePoints?.[player] || 0;
            const wins = weekSummary?.firstPlaces?.[player] || 0;
            const highestScore = weekSummary?.highestSingleScore?.[player] || 0;
            const tieBreakers = weekSummary?.totalTieBreakers?.[player] || 0;
            const tieBreakerValues = weekSummary?.totalTieBreakersByIndex?.[player] || [0, 0, 0];

            aggregate.totalTournamentPoints[player] += tournamentPoints;
            aggregate.totalGamePoints[player] += gamePoints;
            aggregate.firstPlaces[player] += wins;
            aggregate.totalTieBreakers[player] += tieBreakers;
            aggregate.totalTieBreakersByIndex[player] = aggregate.totalTieBreakersByIndex[player].map((value, index) => value + (tieBreakerValues[index] || 0));
            if (highestScore > aggregate.highestSingleScore[player]) {
                aggregate.highestSingleScore[player] = highestScore;
            }
        });
    });

    return aggregate;
}

function renderLeagueHistory() {
    if (!tournament.league?.weekSummaries?.length) return '';

    const historyItems = tournament.league.weekSummaries.map((weekSummary, index) => {
        const entries = buildSummaryEntries(weekSummary);
        const winner = entries[0];
        return `
            <div class="league-history-card">
                <strong>Tydzień ${index + 1}</strong>
                <span>${winner ? `${winner.name} · ${winner.tp} PT` : 'Brak danych'}</span>
            </div>
        `;
    }).join('');

    return `
        <div class="league-history">
            <h4>Historia tygodni</h4>
            <div class="league-history-grid">${historyItems}</div>
        </div>
    `;
}

function getCurrentWeekAttendance() {
    if (!isLeagueMode()) return {};

    const weekIndex = tournament.league.currentWeek;
    if (!tournament.league.weekAttendanceByWeek[weekIndex]) {
        tournament.league.weekAttendanceByWeek[weekIndex] = {};
    }

    return tournament.league.weekAttendanceByWeek[weekIndex];
}

function isPlayerPresentThisWeek(playerName) {
    if (!isLeagueMode()) return true;

    const attendance = getCurrentWeekAttendance();
    return attendance[playerName] !== false;
}

function getPresentPlayersForCurrentWeek() {
    if (!isLeagueMode()) return [...tournament.players];

    return tournament.players.filter(player => isPlayerPresentThisWeek(player));
}

function setPlayerAttendance(playerName, isPresent) {
    if (!isLeagueMode()) return;

    const attendance = getCurrentWeekAttendance();
    attendance[playerName] = Boolean(isPresent);
    saveTournamentState();
    updatePlayerList();
}

function syncAttendanceForCurrentPlayers() {
    if (!isLeagueMode()) return;

    const attendance = getCurrentWeekAttendance();
    tournament.players.forEach(player => {
        if (attendance[player] === undefined) {
            attendance[player] = true;
        }
    });
}

function resetWeeklyTournamentState() {
    tournament.rounds = createRounds(tournament.totalRounds);
    tournament.totalTournamentPoints = {};
    tournament.totalGamePoints = {};
    tournament.firstPlaces = {};
    tournament.highestSingleScore = {};
    tournament.totalTieBreakers = {};
    tournament.totalTieBreakersByIndex = {};
    tournament.currentRound = 0;
}

function prepareNextLeagueWeek() {
    if (!isLeagueMode()) return;

    if (tournament.league.currentWeek >= tournament.league.totalWeeks - 1) {
        tournament.league.phase = 'final-summary';
        displaySummary();
        saveTournamentState();
        return;
    }

    tournament.league.currentWeek += 1;
    tournament.league.phase = 'running';
    resetWeeklyTournamentState();
    document.getElementById('selected-game').innerHTML = renderSelectedGameSummary();
    updatePlayerList();
    setActiveSection('player-section');
    saveTournamentState();
}

function setActiveSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        tournament.activeSection = sectionId;
    }
}

function serializeTournament() {
    return JSON.parse(JSON.stringify(tournament));
}

function saveTournamentState() {
    try {
        localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(serializeTournament()));
    } catch (error) {
        console.warn('Nie udało się zapisać stanu turnieju:', error);
    }
}

function clearTournamentState() {
    try {
        localStorage.removeItem(TOURNAMENT_STORAGE_KEY);
    } catch (error) {
        console.warn('Nie udało się usunąć stanu turnieju:', error);
    }
}

function loadTournamentState() {
    try {
        const rawState = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
        if (!rawState) return false;

        const parsedState = JSON.parse(rawState);
        restoreTournamentFromData(parsedState);
        return true;
    } catch (error) {
        console.warn('Nie udało się wczytać stanu turnieju:', error);
        return false;
    }
}

function downloadTournamentExport() {
    if (!tournament.gameName && tournament.players.length === 0) {
        alert('Najpierw utwórz lub wczytaj turniej.');
        return;
    }

    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tournament: serializeTournament()
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(tournament.gameName || 'turniej').replace(/[^a-z0-9-_]+/gi, '_')}_export.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function triggerTournamentImport() {
    document.getElementById('tournament-import').click();
}

function normalizeTournamentData(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('Nieprawidłowy plik turnieju.');
    }

    const source = data.tournament && typeof data.tournament === 'object' ? data.tournament : data;
    const imported = {
        ...tournament,
        ...source
    };

    imported.players = Array.isArray(imported.players) ? imported.players : [];
    imported.rounds = Array.isArray(imported.rounds) ? imported.rounds : [];
    imported.totalRounds = Math.max(1, parseInt(imported.totalRounds, 10) || 2);
    imported.preferredTableSize = Math.max(3, parseInt(imported.preferredTableSize, 10) || 4);
    imported.currentRound = Math.max(0, Math.min(imported.totalRounds - 1, parseInt(imported.currentRound, 10) || 0));
    imported.activeSection = typeof imported.activeSection === 'string' ? imported.activeSection : 'game-selection';

    imported.rounds = Array.from({ length: imported.totalRounds }, (_, index) => {
        const round = imported.rounds[index] || {};
        return {
            tables: Array.isArray(round.tables) ? round.tables : [],
            scores: round.scores && typeof round.scores === 'object' ? round.scores : {},
            tieBreakers: round.tieBreakers && typeof round.tieBreakers === 'object' ? round.tieBreakers : {},
            tournamentPoints: round.tournamentPoints && typeof round.tournamentPoints === 'object' ? round.tournamentPoints : {}
        };
    });

    imported.totalTournamentPoints = imported.totalTournamentPoints && typeof imported.totalTournamentPoints === 'object' ? imported.totalTournamentPoints : {};
    imported.totalGamePoints = imported.totalGamePoints && typeof imported.totalGamePoints === 'object' ? imported.totalGamePoints : {};
    imported.firstPlaces = imported.firstPlaces && typeof imported.firstPlaces === 'object' ? imported.firstPlaces : {};
    imported.highestSingleScore = imported.highestSingleScore && typeof imported.highestSingleScore === 'object' ? imported.highestSingleScore : {};
    imported.totalTieBreakers = imported.totalTieBreakers && typeof imported.totalTieBreakers === 'object' ? imported.totalTieBreakers : {};
    imported.totalTieBreakersByIndex = imported.totalTieBreakersByIndex && typeof imported.totalTieBreakersByIndex === 'object' ? imported.totalTieBreakersByIndex : {};
    imported.league = imported.league && typeof imported.league === 'object' ? imported.league : createLeagueState();
    imported.league.enabled = Boolean(imported.league.enabled);
    imported.league.totalWeeks = imported.league.enabled ? Math.max(2, Math.min(52, parseInt(imported.league.totalWeeks, 10) || 2)) : 1;
    imported.league.currentWeek = Math.max(0, Math.min(imported.league.totalWeeks - 1, parseInt(imported.league.currentWeek, 10) || 0));
    imported.league.weekSummaries = Array.isArray(imported.league.weekSummaries) ? imported.league.weekSummaries : [];
    imported.league.weekAttendanceByWeek = imported.league.weekAttendanceByWeek && typeof imported.league.weekAttendanceByWeek === 'object' ? imported.league.weekAttendanceByWeek : {};
    imported.league.phase = typeof imported.league.phase === 'string' ? imported.league.phase : (imported.league.enabled ? 'running' : 'inactive');

    return imported;
}

function restoreTournamentFromData(data) {
    tournament = normalizeTournamentData(data);

    document.getElementById('game-name').value = tournament.gameName;
    document.getElementById('round-count').value = tournament.totalRounds;
    document.getElementById('preferred-table-size').value = tournament.preferredTableSize;
    const leagueModeInput = document.getElementById('league-mode');
    const leagueWeeksInput = document.getElementById('league-weeks');
    if (leagueModeInput) leagueModeInput.checked = Boolean(tournament.league.enabled);
    if (leagueWeeksInput) leagueWeeksInput.value = tournament.league.totalWeeks;

    syncAttendanceForCurrentPlayers();
    document.getElementById('selected-game').innerHTML = renderSelectedGameSummary();

    updatePlayerList();

    const startScoringBtn = document.getElementById('start-scoring-btn');
    const finishBtn = document.getElementById('finish-btn');

    if (tournament.activeSection === 'tables-section' || tournament.activeSection === 'scoring-section' || tournament.activeSection === 'summary-section') {
        displayTables();
        if (startScoringBtn) startScoringBtn.style.display = 'block';
    }

    if (tournament.activeSection === 'scoring-section' || tournament.activeSection === 'summary-section') {
        displayScoringSection();
        if (finishBtn) {
            finishBtn.style.display = tournament.activeSection === 'scoring-section' ? 'block' : 'none';
            finishBtn.textContent = tournament.currentRound < tournament.totalRounds - 1 ? 'Następna Runda' : 'Zakończ Turniej';
        }
    }

    if (tournament.activeSection === 'summary-section') {
        calculateFinalResults();
        displaySummary();
    }

    setActiveSection(tournament.activeSection);
    saveTournamentState();
}

function handleTournamentImport(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result || '{}'));
            restoreTournamentFromData(parsed);
        } catch (error) {
            alert('Nie udało się wczytać pliku turnieju. Sprawdź, czy to poprawny eksport JSON.');
        }
    };
    reader.readAsText(file);
}

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
    readLeagueConfig();
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
    
    document.getElementById('selected-game').innerHTML = renderSelectedGameSummary();
    
    setActiveSection('player-section');
    gameInput.value = '';
    saveTournamentState();
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
    if (isLeagueMode()) {
        getCurrentWeekAttendance()[playerName] = true;
    }
    playerInput.value = '';
    updatePlayerList();
    saveTournamentState();
}

function updatePlayerList() {
    const playerList = document.getElementById('player-list');
    const attendanceList = document.getElementById('attendance-list');
    
    if (tournament.players.length === 0) {
        playerList.innerHTML = '<p style="color: #999;">Brak graczy. Dodaj pierwszego gracza.</p>';
        document.getElementById('generate-tables-btn').style.display = 'none';
        if (attendanceList) {
            attendanceList.innerHTML = '';
            attendanceList.style.display = 'none';
        }
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

    if (attendanceList) {
        if (isLeagueMode()) {
            syncAttendanceForCurrentPlayers();
            attendanceList.style.display = 'block';
            attendanceList.innerHTML = `
                <h3 style="color: #764ba2; margin: 20px 0 10px;">Obecność na tydzień ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks}</h3>
                <p style="color: #666; margin-bottom: 12px;">Odznacz osoby, których nie ma dzisiaj. Nie trafią do losowania stołów.</p>
                <div class="attendance-list-grid">
                    ${tournament.players.map(player => `
                        <label class="attendance-item">
                            <input type="checkbox" ${isPlayerPresentThisWeek(player) ? 'checked' : ''} onchange="setPlayerAttendance('${player}', this.checked)">
                            <span>${player}</span>
                        </label>
                    `).join('')}
                </div>
            `;
        } else {
            attendanceList.innerHTML = '';
            attendanceList.style.display = 'none';
        }
    }
}

function removePlayer(index) {
    const removedPlayer = tournament.players[index];
    tournament.players.splice(index, 1);
    if (isLeagueMode()) {
        Object.values(tournament.league.weekAttendanceByWeek || {}).forEach(weekAttendance => {
            if (weekAttendance && removedPlayer in weekAttendance) {
                delete weekAttendance[removedPlayer];
            }
        });
    }
    updatePlayerList();
    saveTournamentState();
}

// --- GENEROWANIE I EDYCJA STOŁÓW ---

function generateTables() {
    const playersForToday = getPresentPlayersForCurrentWeek();

    if (playersForToday.length < 3) {
        alert('Potrzebujesz co najmniej 3 obecnych graczy!');
        return;
    }

    readTournamentConfig();
    if (isLeagueMode()) {
        tournament.league.phase = 'running';
    }

    tournament.rounds = createRounds(tournament.totalRounds);
    tournament.totalTournamentPoints = {};
    tournament.totalGamePoints = {};
    tournament.firstPlaces = {};
    tournament.highestSingleScore = {};
    tournament.totalTieBreakers = {};
    
    tournament.currentRound = 0;
    generateRoundTables(0);
    
    displayTables();
    setActiveSection('tables-section');
    document.getElementById('start-scoring-btn').style.display = 'block';
    saveTournamentState();
}

function generateRoundTables(roundIndex) {
    let shuffledPlayers;
    if (roundIndex === 0) {
        shuffledPlayers = [...getPresentPlayersForCurrentWeek()].sort(() => Math.random() - 0.5);
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
    
    const availablePlayers = getPresentPlayersForCurrentWeek();
    const tableStructure = calculateTableStructure(availablePlayers.length, tournament.preferredTableSize);
    let bestArrangement = null;
    let minRepeats = Infinity;
    
    for (let attempt = 0; attempt < 100; attempt++) {
        const shuffled = [...availablePlayers].sort(() => Math.random() - 0.5);
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
    return bestArrangement || [...availablePlayers].sort(() => Math.random() - 0.5);
}

// NOWA FUNKCJA: Wyświetlanie z opcją ręcznej zmiany stołu
function displayTables() {
    const tablesDisplay = document.getElementById('tables-display');
    const currentRound = tournament.rounds[tournament.currentRound];
    const allTables = currentRound.tables;
    
    tablesDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 15px;">Runda ${tournament.currentRound + 1}/${tournament.totalRounds}${getLeagueWeekLabel()}</h3>
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
    saveTournamentState();
}

function regenerateTables() {
    generateRoundTables(tournament.currentRound);
    displayTables();
    saveTournamentState();
}

// --- PUNKTACJA ---

function startScoring() {
    displayScoringSection();
    setActiveSection('scoring-section');
    const finishBtn = document.getElementById('finish-btn');
    finishBtn.style.display = 'block';
    finishBtn.textContent = tournament.currentRound < tournament.totalRounds - 1
        ? 'Następna Runda'
        : (isLeagueMode() ? 'Zakończ dzień' : 'Zakończ Turniej');
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
        <h3 style="color: #764ba2; margin-bottom: 20px;">Runda ${tournament.currentRound + 1} - Wyniki${getLeagueWeekLabel()}</h3>
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
    saveTournamentState();
}

function updateTieBreaker(player, index, value) {
    const currentRound = tournament.rounds[tournament.currentRound];
    currentRound.tieBreakers[player] = normalizeTieBreakers(currentRound.tieBreakers[player]);
    currentRound.tieBreakers[player][index] = parseInt(value) || 0;
    saveTournamentState();
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

    saveTournamentState();
}

// --- PODSUMOWANIE I RESET ---

function finishTournament() {
    const currentRound = tournament.rounds[tournament.currentRound];
    const roundPlayers = currentRound.tables.flatMap(table => table.players);
    const allCalculated = roundPlayers.every(player => currentRound.tournamentPoints[player] !== undefined);
    
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
        saveTournamentState();
    } else {
        calculateFinalResults();
        if (isLeagueMode()) {
            tournament.league.weekSummaries[tournament.league.currentWeek] = captureCurrentWeekSummary();
            tournament.league.phase = tournament.league.currentWeek < tournament.league.totalWeeks - 1 ? 'weekly-summary' : 'final-summary';
        }
        displaySummary();
        setActiveSection('summary-section');
        saveTournamentState();
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
    const summaryActions = document.getElementById('summary-actions');

    if (isLeagueMode() && tournament.league.phase === 'weekly-summary') {
        const weekSummary = tournament.league.weekSummaries[tournament.league.currentWeek] || captureCurrentWeekSummary();
        const entries = buildSummaryEntries(weekSummary);

        summaryDisplay.innerHTML = renderSummaryBlock(
            `Podsumowanie dnia - tydzień ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks}`,
            'Wyniki bieżącego tygodnia ligowego.',
            entries
        );
        summaryDisplay.innerHTML += renderLeagueHistory();
        if (summaryActions) {
            summaryActions.innerHTML = `
                <button onclick="prepareNextLeagueWeek()" class="btn-primary">Następny tydzień</button>
                <button onclick="resetTournament()" class="btn-secondary">Przerwij ligę</button>
            `;
        }
        tournament.activeSection = 'summary-section';
        return;
    }

    if (isLeagueMode() && tournament.league.phase === 'final-summary') {
        const aggregate = buildLeagueAggregateSummary();
        const entries = buildSummaryEntries(aggregate);

        summaryDisplay.innerHTML = `
            <div class="league-summary-layout">
                <div class="league-summary-main">
                    ${renderSummaryBlock(
                        '🏆 Podsumowanie ligi',
                        `Łącznie ${tournament.league.totalWeeks} tygodni gry.`,
                        entries
                    )}
                </div>
                ${renderLeagueBalanceBlock(aggregate)}
            </div>
            ${renderLeagueHistory()}
        `;
        if (summaryActions) {
            summaryActions.innerHTML = `<button onclick="resetTournament()" class="btn-secondary">Nowa liga</button>`;
        }
        tournament.activeSection = 'summary-section';
        return;
    }

    const entries = buildSummaryEntries({
        totalTournamentPoints: tournament.totalTournamentPoints,
        totalGamePoints: tournament.totalGamePoints,
        firstPlaces: tournament.firstPlaces,
        highestSingleScore: tournament.highestSingleScore,
        totalTieBreakers: tournament.totalTieBreakers,
        totalTieBreakersByIndex: tournament.totalTieBreakersByIndex
    });

    summaryDisplay.innerHTML = renderSummaryBlock('🏆 Podsumowanie Turnieju', 'Ranking końcowy turnieju.', entries);
    if (summaryActions) {
        summaryActions.innerHTML = '<button onclick="resetTournament()" class="btn-secondary">Nowy Turniej</button>';
    }

    tournament.activeSection = 'summary-section';
}

function resetTournament() {
    if (!confirm('Nowy turniej?')) return;

    clearTournamentState();
    location.reload();
}

// Start
readTournamentConfig();
if (!loadTournamentState()) {
    updatePlayerList();
}
