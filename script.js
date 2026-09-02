// Stan aplikacji
let tournament = {
    gameName: '',
    players: [],
    currentRound: 0,
    totalRounds: 2,
    minTableSize: 3,
    maxTableSize: 6,
    preferredTableSize: 4,
    activeSection: 'game-selection',
    scoringMode: 'game',
    customScoringByPlace: { 1: 3, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    tieBreakersConfig: {
        count: 3,
        method: 'priority'
    },
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
    totalNormalizedScore: {},
    highestNormalizedScore: {},
    totalTieBreakers: {},
    totalTieBreakersByIndex: {}
};

const TIE_BREAKER_COUNT = 3;
const TOURNAMENT_STORAGE_KEY = 'chempionship-boardgames-tournament';
const PLAYER_HISTORY_KEY = 'chempionship-player-history';

// Szablony turniejów
const TOURNAMENT_TEMPLATES = {
    quick: {
        name: 'Quick (3 rundy)',
        totalRounds: 3,
        minTableSize: 2,
        maxTableSize: 5,
        preferredTableSize: 3,
        tieBreakersConfig: { count: 2, method: 'priority' }
    },
    standard: {
        name: 'Standard (4 rundy)',
        totalRounds: 4,
        minTableSize: 3,
        maxTableSize: 6,
        preferredTableSize: 4,
        tieBreakersConfig: { count: 3, method: 'priority' }
    },
    extended: {
        name: 'Extended (5 rund)',
        totalRounds: 5,
        minTableSize: 3,
        maxTableSize: 6,
        preferredTableSize: 4,
        tieBreakersConfig: { count: 3, method: 'sum' }
    }
};

let playerHistory = {};

function loadPlayerHistory() {
    try {
        const stored = localStorage.getItem(PLAYER_HISTORY_KEY);
        playerHistory = stored ? JSON.parse(stored) : {};
    } catch (e) {
        playerHistory = {};
    }
}

function savePlayerHistory() {
    try {
        localStorage.setItem(PLAYER_HISTORY_KEY, JSON.stringify(playerHistory));
    } catch (e) {
        console.error('Nie można zapisać historii graczy', e);
    }
}

function getPlayerStats(playerName) {
    if (!playerHistory[playerName]) {
        playerHistory[playerName] = { games: 0, totalPoints: 0, firstPlaces: 0, tournamentIds: [] };
    }
    const stats = playerHistory[playerName];
    return {
        games: stats.games || 0,
        totalPoints: stats.totalPoints || 0,
        firstPlaces: stats.firstPlaces || 0,
        avgPoints: stats.games ? (stats.totalPoints / stats.games).toFixed(1) : 0,
        winRate: stats.games ? ((stats.firstPlaces / stats.games) * 100).toFixed(1) : 0
    };
}

function updatePlayerHistory() {
    if (!tournament.players || tournament.players.length === 0) return;
    
    const tourneyId = `${tournament.gameName}-${Date.now()}`;
    
    tournament.players.forEach(player => {
        if (!playerHistory[player]) {
            playerHistory[player] = { games: 0, totalPoints: 0, firstPlaces: 0, tournamentIds: [] };
        }
        
        const stats = playerHistory[player];
        stats.games++;
        stats.totalPoints += (tournament.totalTournamentPoints[player] || 0);
        if (tournament.firstPlaces[player]) stats.firstPlaces++;
        if (!stats.tournamentIds) stats.tournamentIds = [];
        stats.tournamentIds.push(tourneyId);
    });
    
    savePlayerHistory();
}

function applyTournamentTemplate(templateKey) {
    const template = TOURNAMENT_TEMPLATES[templateKey];
    if (!template) return;
    
    const roundInput = document.getElementById('round-count');
    const minInput = document.getElementById('min-table-size');
    const maxInput = document.getElementById('max-table-size');
    const prefInput = document.getElementById('preferred-table-size');
    const tbCountInput = document.getElementById('tb-count');
    const tbMethodInput = document.getElementById('tb-method');
    
    if (roundInput) roundInput.value = template.totalRounds;
    if (minInput) minInput.value = template.minTableSize;
    if (maxInput) maxInput.value = template.maxTableSize;
    if (prefInput) prefInput.value = template.preferredTableSize;
    if (tbCountInput) tbCountInput.value = template.tieBreakersConfig.count;
    if (tbMethodInput) tbMethodInput.value = template.tieBreakersConfig.method;
}

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

    const methodLabels = { priority: 'Priorytet', sum: 'Suma', average: 'Średnia', max: 'Maksimum' };
    const methodDisplay = methodLabels[tournament.tieBreakersConfig?.method] || 'Priorytet';
    
    return `
        <strong>Wybrana gra:</strong> ${tournament.gameName}<br>
        <span style="color:#667eea; font-weight: 500;">Rundy: ${tournament.totalRounds} · Stół: min ${tournament.minTableSize}, max ${tournament.maxTableSize}, preferowana ${tournament.preferredTableSize} · TB: ${tournament.tieBreakersConfig?.count || 3} (${methodDisplay})</span>${leagueLine}
    `;
}

// Bezpośrednie starcie: dla dwóch remisujących graczy sprawdza wszystkie
// rundy, w których siedzieli przy tym samym stole, i liczy w ilu z nich
// który zajął wyższe miejsce. Zwraca różnicę "zwycięstw" (analogicznie do
// pozostałych kryteriów: dodatnia wartość = b lepszy, ujemna = a lepszy).
// Jeśli gracze nigdy nie grali razem, zwraca 0 (kryterium nie rozstrzyga).
function compareHeadToHead(playerA, playerB, rounds) {
    let aWins = 0;
    let bWins = 0;

    (rounds || []).forEach(round => {
        const table = (round.tables || []).find(t =>
            Array.isArray(t.players) && t.players.includes(playerA) && t.players.includes(playerB)
        );
        if (!table || !round.places) return;

        const placeA = round.places[playerA];
        const placeB = round.places[playerB];
        if (placeA === undefined || placeB === undefined) return;

        if (placeA < placeB) aWins++;
        else if (placeB < placeA) bWins++;
    });

    return bWins - aWins;
}

function buildSummaryEntries(summarySource, roundsForH2H) {
    const rounds = roundsForH2H || tournament.rounds;
    return [...tournament.players].map(player => ({
        name: player,
        tp: summarySource.totalTournamentPoints[player] || 0,
        wins: summarySource.firstPlaces[player] || 0,
        gp: summarySource.totalGamePoints[player] || 0,
        high: summarySource.highestSingleScore[player] || 0,
        gpNorm: summarySource.totalNormalizedScore ? (summarySource.totalNormalizedScore[player] || 0) : 0,
        highNorm: summarySource.highestNormalizedScore ? (summarySource.highestNormalizedScore[player] || 0) : 0,
        tbi: summarySource.totalTieBreakersByIndex[player] || [0, 0, 0],
        tbs: summarySource.totalTieBreakers[player] || 0
    })).sort((a, b) =>
        b.tp - a.tp ||
        b.wins - a.wins ||
        b.gpNorm - a.gpNorm ||
        b.highNorm - a.highNorm ||
        compareHeadToHead(a.name, b.name, rounds) ||
        compareTieBreakers(a.tbi, b.tbi)
    );
}

function renderSummaryBlock(title, subtitle, entries) {
    return `
        <h3 style="color: #764ba2; margin-bottom: 12px;">${title}</h3>
        ${subtitle ? `<p style="margin-bottom: 16px; color: #666;">${subtitle}</p>` : ''}
        <table class="summary-table">
            <thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>W</th><th>Pkt Gry</th><th>Wynik znorm.</th><th>Suma TB</th></tr></thead>
            <tbody>
                ${entries.map((p, i) => `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                    <td>${i + 1}</td><td>${p.name}</td><td>${p.tp}</td><td>${p.wins}</td><td>${p.gp}</td><td>${p.gpNorm}%</td><td>${p.tbs}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    `;
}

function renderLeagueBalanceBlock(summarySource, roundsForH2H) {
    const entries = buildSummaryEntries(summarySource, roundsForH2H);

    return `
        <div class="league-balance-panel">
            <h3 style="color: #764ba2; margin-bottom: 12px;">Bilans ligi</h3>
            <p style="margin-bottom: 16px; color: #666;">Zestawienie całej ligi po wszystkich tygodniach.</p>
            <table class="summary-table league-balance-table">
                <thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>W</th><th>Pkt Gry</th><th>Wynik znorm.</th><th>Suma TB</th></tr></thead>
                <tbody>
                    ${entries.map((p, i) => `<tr class="${i < 3 ? 'rank-' + (i + 1) : ''}">
                        <td>${i + 1}</td><td>${p.name}</td><td>${p.tp}</td><td>${p.wins}</td><td>${p.gp}</td><td>${p.gpNorm}%</td><td>${p.tbs}</td>
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
        totalNormalizedScore: JSON.parse(JSON.stringify(tournament.totalNormalizedScore)),
        highestNormalizedScore: JSON.parse(JSON.stringify(tournament.highestNormalizedScore)),
        totalTieBreakers: JSON.parse(JSON.stringify(tournament.totalTieBreakers)),
        totalTieBreakersByIndex: JSON.parse(JSON.stringify(tournament.totalTieBreakersByIndex)),
        rounds: JSON.parse(JSON.stringify(tournament.rounds))
    };
}

function buildLeagueAggregateSummary() {
    const aggregate = {
        totalTournamentPoints: {},
        totalGamePoints: {},
        firstPlaces: {},
        highestSingleScore: {},
        totalNormalizedScore: {},
        highestNormalizedScore: {},
        totalTieBreakers: {},
        totalTieBreakersByIndex: {}
    };

    tournament.players.forEach(player => {
        aggregate.totalTournamentPoints[player] = 0;
        aggregate.totalGamePoints[player] = 0;
        aggregate.firstPlaces[player] = 0;
        aggregate.highestSingleScore[player] = 0;
        aggregate.totalNormalizedScore[player] = 0;
        aggregate.highestNormalizedScore[player] = 0;
        aggregate.totalTieBreakers[player] = 0;
        aggregate.totalTieBreakersByIndex[player] = [0, 0, 0];
    });

    (tournament.league?.weekSummaries || []).forEach(weekSummary => {
        tournament.players.forEach(player => {
            const tournamentPoints = weekSummary?.totalTournamentPoints?.[player] || 0;
            const gamePoints = weekSummary?.totalGamePoints?.[player] || 0;
            const wins = weekSummary?.firstPlaces?.[player] || 0;
            const highestScore = weekSummary?.highestSingleScore?.[player] || 0;
            const normalizedScore = weekSummary?.totalNormalizedScore?.[player] || 0;
            const highestNormalized = weekSummary?.highestNormalizedScore?.[player] || 0;
            const tieBreakers = weekSummary?.totalTieBreakers?.[player] || 0;
            const tieBreakerValues = weekSummary?.totalTieBreakersByIndex?.[player] || [0, 0, 0];

            aggregate.totalTournamentPoints[player] += tournamentPoints;
            aggregate.totalGamePoints[player] += gamePoints;
            aggregate.firstPlaces[player] += wins;
            aggregate.totalNormalizedScore[player] += normalizedScore;
            aggregate.totalTieBreakers[player] += tieBreakers;
            aggregate.totalTieBreakersByIndex[player] = aggregate.totalTieBreakersByIndex[player].map((value, index) => value + (tieBreakerValues[index] || 0));
            if (highestScore > aggregate.highestSingleScore[player]) {
                aggregate.highestSingleScore[player] = highestScore;
            }
            if (highestNormalized > aggregate.highestNormalizedScore[player]) {
                aggregate.highestNormalizedScore[player] = highestNormalized;
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
    tournament.totalNormalizedScore = {};
    tournament.highestNormalizedScore = {};
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
            tournamentPoints: round.tournamentPoints && typeof round.tournamentPoints === 'object' ? round.tournamentPoints : {},
            places: round.places && typeof round.places === 'object' ? round.places : {},
            normalizedScores: round.normalizedScores && typeof round.normalizedScores === 'object' ? round.normalizedScores : {}
        };
    });

    imported.totalTournamentPoints = imported.totalTournamentPoints && typeof imported.totalTournamentPoints === 'object' ? imported.totalTournamentPoints : {};
    imported.totalGamePoints = imported.totalGamePoints && typeof imported.totalGamePoints === 'object' ? imported.totalGamePoints : {};
    imported.firstPlaces = imported.firstPlaces && typeof imported.firstPlaces === 'object' ? imported.firstPlaces : {};
    imported.highestSingleScore = imported.highestSingleScore && typeof imported.highestSingleScore === 'object' ? imported.highestSingleScore : {};
    imported.totalNormalizedScore = imported.totalNormalizedScore && typeof imported.totalNormalizedScore === 'object' ? imported.totalNormalizedScore : {};
    imported.highestNormalizedScore = imported.highestNormalizedScore && typeof imported.highestNormalizedScore === 'object' ? imported.highestNormalizedScore : {};
    imported.totalTieBreakers = imported.totalTieBreakers && typeof imported.totalTieBreakers === 'object' ? imported.totalTieBreakers : {};
    imported.totalTieBreakersByIndex = imported.totalTieBreakersByIndex && typeof imported.totalTieBreakersByIndex === 'object' ? imported.totalTieBreakersByIndex : {};
    imported.league = imported.league && typeof imported.league === 'object' ? imported.league : createLeagueState();
    imported.league.enabled = Boolean(imported.league.enabled);
    imported.league.totalWeeks = imported.league.enabled ? Math.max(2, Math.min(52, parseInt(imported.league.totalWeeks, 10) || 2)) : 1;
    imported.league.currentWeek = Math.max(0, Math.min(imported.league.totalWeeks - 1, parseInt(imported.league.currentWeek, 10) || 0));
    imported.league.weekSummaries = Array.isArray(imported.league.weekSummaries) ? imported.league.weekSummaries : [];
    imported.league.weekAttendanceByWeek = imported.league.weekAttendanceByWeek && typeof imported.league.weekAttendanceByWeek === 'object' ? imported.league.weekAttendanceByWeek : {};
    imported.league.phase = typeof imported.league.phase === 'string' ? imported.league.phase : (imported.league.enabled ? 'running' : 'inactive');
    imported.tieBreakersConfig = imported.tieBreakersConfig && typeof imported.tieBreakersConfig === 'object' ? imported.tieBreakersConfig : { count: 3, method: 'priority' };
    imported.tieBreakersConfig.count = Math.max(1, Math.min(5, parseInt(imported.tieBreakersConfig.count, 10) || 3));
    imported.tieBreakersConfig.method = ['priority', 'sum', 'average', 'max'].includes(imported.tieBreakersConfig.method) ? imported.tieBreakersConfig.method : 'priority';
    imported.scoringMode = ['game', 'custom'].includes(imported.scoringMode) ? imported.scoringMode : 'game';
    imported.customScoringByPlace = imported.customScoringByPlace && typeof imported.customScoringByPlace === 'object' ? imported.customScoringByPlace : { 1: 3, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };

    return imported;
}

function restoreTournamentFromData(data) {
    tournament = normalizeTournamentData(data);

    document.getElementById('game-name').value = tournament.gameName;
    document.getElementById('round-count').value = tournament.totalRounds;
    const minTableSizeInput = document.getElementById('min-table-size');
    const maxTableSizeInput = document.getElementById('max-table-size');
    const preferredTableSizeInput = document.getElementById('preferred-table-size');
    const tbCountInput = document.getElementById('tb-count');
    const tbMethodInput = document.getElementById('tb-method');
    if (minTableSizeInput) minTableSizeInput.value = tournament.minTableSize;
    if (maxTableSizeInput) maxTableSizeInput.value = tournament.maxTableSize;
    if (preferredTableSizeInput) preferredTableSizeInput.value = tournament.preferredTableSize;
    if (tbCountInput) tbCountInput.value = tournament.tieBreakersConfig?.count || 3;
    if (tbMethodInput) tbMethodInput.value = tournament.tieBreakersConfig?.method || 'priority';
    const scoreRadio = document.getElementById('scoring-game');
    if (scoreRadio) scoreRadio.checked = tournament.scoringMode === 'game';
    const customRadio = document.getElementById('scoring-custom');
    if (customRadio) customRadio.checked = tournament.scoringMode === 'custom';
    updateScoringMode();
    const leagueWeeksInput = document.getElementById('league-weeks');
    const leagueModeInput = document.getElementById('league-mode');
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
        tournamentPoints: {},
        places: {},
        normalizedScores: {}
    }));
}

function normalizeTieBreakers(tieBreakers) {
    const count = tournament.tieBreakersConfig?.count || TIE_BREAKER_COUNT;
    const normalized = Array.isArray(tieBreakers) ? [...tieBreakers] : [];
    while (normalized.length < count) normalized.push(0);
    return normalized.slice(0, count);
}

function compareTieBreakers(a, b) {
    const method = tournament.tieBreakersConfig?.method || 'priority';
    const count = tournament.tieBreakersConfig?.count || TIE_BREAKER_COUNT;
    const normalizedA = normalizeTieBreakers(a);
    const normalizedB = normalizeTieBreakers(b);
    
    if (method === 'priority') {
        for (let i = 0; i < count; i++) {
            const diff = (normalizedB[i] || 0) - (normalizedA[i] || 0);
            if (diff !== 0) return diff;
        }
        return 0;
    } else if (method === 'sum') {
        const sumA = normalizedA.reduce((s, v) => s + (v || 0), 0);
        const sumB = normalizedB.reduce((s, v) => s + (v || 0), 0);
        return sumB - sumA;
    } else if (method === 'average') {
        const sumA = normalizedA.reduce((s, v) => s + (v || 0), 0);
        const sumB = normalizedB.reduce((s, v) => s + (v || 0), 0);
        return (sumB / count) - (sumA / count);
    } else if (method === 'max') {
        const maxA = Math.max(...normalizedA, 0);
        const maxB = Math.max(...normalizedB, 0);
        return maxB - maxA;
    }
    return 0;
}

function readTournamentConfig() {
    const roundInput = document.getElementById('round-count');
    const minTableSizeInput = document.getElementById('min-table-size');
    const maxTableSizeInput = document.getElementById('max-table-size');
    const preferredTableSizeInput = document.getElementById('preferred-table-size');
    const tbCountInput = document.getElementById('tb-count');
    const tbMethodInput = document.getElementById('tb-method');
    const scoringModeInput = document.querySelector('input[name="scoring-mode"]:checked');

    const rounds = Math.max(1, Math.min(10, parseInt(roundInput?.value, 10) || 2));
    const minSize = Math.max(2, Math.min(8, parseInt(minTableSizeInput?.value, 10) || 3));
    const maxSize = Math.max(minSize, Math.min(8, parseInt(maxTableSizeInput?.value, 10) || 6));
    const preferredSize = Math.max(minSize, Math.min(maxSize, parseInt(preferredTableSizeInput?.value, 10) || 4));
    const tbCount = Math.max(1, Math.min(5, parseInt(tbCountInput?.value, 10) || 3));
    const tbMethod = tbMethodInput?.value || 'priority';
    const scoringMode = scoringModeInput?.value || 'game';

    tournament.totalRounds = rounds;
    tournament.minTableSize = minSize;
    tournament.maxTableSize = maxSize;
    tournament.preferredTableSize = preferredSize;
    tournament.tieBreakersConfig = { count: tbCount, method: tbMethod };
    tournament.scoringMode = scoringMode;
    
    if (scoringMode === 'custom') {
        readCustomScoringConfig();
    }
    
    readLeagueConfig();
}

function updateScoringMode() {
    const customScoringConfig = document.getElementById('custom-scoring-config');
    const isScoringCustom = document.getElementById('scoring-custom')?.checked;
    
    if (isScoringCustom) {
        customScoringConfig.style.display = 'block';
        renderCustomScoringInputs();
    } else {
        customScoringConfig.style.display = 'none';
    }
}

function renderCustomScoringInputs() {
    const container = document.getElementById('scoring-inputs');
    let html = '';
    for (let place = 1; place <= 8; place++) {
        const currentValue = tournament.customScoringByPlace[place] || 0;
        html += `
            <div style="display: flex; flex-direction: column; align-items: center;">
                <label style="font-size: 12px; color: #666; margin-bottom: 4px;">Miejsce ${place}</label>
                <input type="number" id="scoring-place-${place}" min="0" max="10" value="${currentValue}" style="width: 60px; padding: 6px; text-align: center; border: 2px solid #e0e0e0; border-radius: 4px;">
            </div>
        `;
    }
    container.innerHTML = html;
}

function readCustomScoringConfig() {
    for (let place = 1; place <= 8; place++) {
        const input = document.getElementById(`scoring-place-${place}`);
        if (input) {
            tournament.customScoringByPlace[place] = Math.max(0, Math.min(10, parseInt(input.value, 10) || 0));
        }
    }
}

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
    
    displayPlayerStats();
}

function displayPlayerStats() {
    const statsDiv = document.getElementById('player-stats');
    if (!statsDiv || tournament.players.length === 0) return;
    
    const statsHtml = tournament.players.map(player => {
        const stats = getPlayerStats(player);
        return `
            <div style="padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 8px;">
                <strong style="color: #667eea;">${player}</strong>
                <div style="font-size: 13px; color: #666; margin-top: 4px;">
                    Gier: <span style="font-weight: 600;">${stats.games}</span> | 
                    Srednia: <span style="font-weight: 600;">${stats.avgPoints}</span> | 
                    Win Rate: <span style="font-weight: 600;">${stats.winRate}%</span> | 
                    1. miejsca: <span style="font-weight: 600;">${stats.firstPlaces}</span>
                </div>
            </div>
        `;
    }).join('');
    
    statsDiv.innerHTML = `
        <h3 style="color: #667eea; margin-bottom: 12px;">Statystyki graczy</h3>
        ${statsHtml}
    `;
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
    tournament.totalNormalizedScore = {};
    tournament.highestNormalizedScore = {};
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
    const tableSizes = calculateTableStructure(totalPlayers, tournament.minTableSize, tournament.maxTableSize, tournament.preferredTableSize);
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

function calculateTableStructure(totalPlayers, minSize, maxSize, preferredSize) {
    if (totalPlayers < minSize) {
        return [];
    }

    let bestArrangement = null;
    let bestScore = Infinity;

    for (let tableCount = 1; tableCount <= Math.ceil(totalPlayers / minSize); tableCount++) {
        const avgSize = totalPlayers / tableCount;
        if (avgSize < minSize || avgSize > maxSize) continue;

        const baseSize = Math.floor(totalPlayers / tableCount);
        const remainder = totalPlayers % tableCount;

        if (baseSize < minSize || baseSize + (remainder > 0 ? 1 : 0) > maxSize) continue;

        const sizes = Array.from({ length: tableCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
        const score = sizes.reduce((sum, size) => sum + Math.abs(size - preferredSize), 0);

        if (score < bestScore) {
            bestScore = score;
            bestArrangement = sizes;
        }
    }

    return bestArrangement || [];
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
    const tableStructure = calculateTableStructure(availablePlayers.length, tournament.minTableSize, tournament.maxTableSize, tournament.preferredTableSize);
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
            💡 <strong>Ręczna edycja:</strong> Wybierz stół obok gracza, aby go przenieść. Kliknij X, aby usunąć gracza z turnieju.
        </p>
        ${allTables.map(table => `
            <div class="table">
                <h3>Stół ${table.tableNumber}</h3>
                <div class="table-players">
                    ${table.players.map(player => `
                        <div class="table-player" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; background: white; padding: 8px; border-radius: 6px; border-left: 3px solid #667eea;">
                            <span>${player}</span>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <select onchange="movePlayerToTable('${player}', this.value)" style="padding: 4px; border-radius: 4px; border: 1px solid #ddd; font-size: 12px; cursor: pointer;">
                                    ${allTables.map(t => `
                                        <option value="${t.tableNumber}" ${t.tableNumber === table.tableNumber ? 'selected' : ''}>
                                            Stół ${t.tableNumber}
                                        </option>
                                    `).join('')}
                                </select>
                                <button onclick="removePlayerDuringTournament('${player}')" class="btn-remove-player" title="Usuń gracza">✕</button>
                            </div>
                        </div>
                    `).join('')}
                    ${table.players.length === 0 ? '<p style="color: #ccc; font-style: italic;">Stół pusty</p>' : ''}
                </div>
            </div>
        `).join('')}
    `;
}

function removePlayerDuringTournament(playerName) {
    if (!confirm(`Usunąć ${playerName} z turnieju? Jego wyniki z poprzednich rund będą zachowane, ale nie będzie grać w pozostałych rundach.`)) {
        return;
    }

    const currentRound = tournament.currentRound;

    for (let roundIdx = currentRound; roundIdx < tournament.rounds.length; roundIdx++) {
        const round = tournament.rounds[roundIdx];
        round.tables.forEach(table => {
            table.players = table.players.filter(p => p !== playerName);
        });
        if (round.scores) delete round.scores[playerName];
        if (round.tieBreakers) delete round.tieBreakers[playerName];
        if (round.tournamentPoints) delete round.tournamentPoints[playerName];
    }

    if (currentRound < tournament.rounds.length - 1) {
        for (let roundIdx = currentRound + 1; roundIdx < tournament.rounds.length; roundIdx++) {
            generateRoundTables(roundIdx);
        }
    }

    displayTables();
    saveTournamentState();
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
    const tbCount = tournament.tieBreakersConfig?.count || TIE_BREAKER_COUNT;

    currentRound.tables.forEach(table => {
        table.players.forEach(player => {
            if (currentRound.scores[player] === undefined) currentRound.scores[player] = 0;
            currentRound.tieBreakers[player] = normalizeTieBreakers(currentRound.tieBreakers[player]);
        });
    });
    
    const tbInputsHtml = Array.from({length: tbCount}, (_, i) => 
        `<input type="number" onchange="updateTieBreaker('${'PLAYER'}', ${i}, this.value)" value="${'TB_VALUE_' + i}" placeholder="TB${i + 1}">`
    ).join('');
    
    scoringDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 20px;">Runda ${tournament.currentRound + 1} - Wyniki${getLeagueWeekLabel()}</h3>
        ${currentRound.tables.map(table => table.players.length > 0 ? `
            <div class="scoring-table">
                <h3>Stół ${table.tableNumber}</h3>
                ${table.players.map(player => {
                    const tbInputs = Array.from({length: tbCount}, (_, i) => 
                        `<input type="number" onchange="updateTieBreaker('${player}', ${i}, this.value)" value="${currentRound.tieBreakers[player][i]}" placeholder="TB${i + 1}">`
                    ).join('');
                    return `
                    <div class="score-input-group">
                        <label>${player}:</label>
                        <input type="number" onchange="updateScore('${player}', this.value)" value="${currentRound.scores[player]}" placeholder="Pkt">
                        ${tbInputs}
                        <span id="tournament-points-${tournament.currentRound}-${player}" style="color: #764ba2; font-weight: bold; min-width: 60px;"></span>
                    </div>
                `;
                }).join('')}
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

// Punkty turniejowe za miejsce - stała tabela niezależna od wielkości stołu
// (1. miejsce = 3 pkt, 2. = 2 pkt, 3. = 1 pkt, 4. = 0 pkt w trybie domyślnym,
// albo wartości z customScoringByPlace w trybie custom).
function getPointsForPlace(place) {
    if (tournament.scoringMode === 'custom') {
        return tournament.customScoringByPlace[place] || 0;
    }
    const defaultPoints = [3, 2, 1, 0];
    return defaultPoints[place - 1] || 0;
}

function calculateTablePoints(tableIndex) {
    const currentRound = tournament.rounds[tournament.currentRound];
    const table = currentRound.tables[tableIndex];

    if (!currentRound.places || typeof currentRound.places !== 'object') {
        currentRound.places = {};
    }
    if (!currentRound.normalizedScores || typeof currentRound.normalizedScores !== 'object') {
        currentRound.normalizedScores = {};
    }

    const sortedPlayers = [...table.players].sort((a, b) => {
        const scoreDiff = currentRound.scores[b] - currentRound.scores[a];
        if (scoreDiff !== 0) return scoreDiff;
        return compareTieBreakers(normalizeTieBreakers(currentRound.tieBreakers[a]), normalizeTieBreakers(currentRound.tieBreakers[b]));
    });

    // Wynik zwycięzcy stołu - punkt odniesienia do normalizacji surowego wyniku z gry,
    // żeby stoły z mniejszą liczbą graczy (naturalnie wyższe wyniki) nie miały
    // przewagi w tie-breakach opartych o "Pkt Gry".
    const winnerScore = currentRound.scores[sortedPlayers[0]] || 0;

    sortedPlayers.forEach((player, index) => {
        const place = index + 1;
        const pts = getPointsForPlace(place);
        const rawScore = currentRound.scores[player] || 0;
        const normalizedScore = winnerScore > 0 ? Math.round((rawScore / winnerScore) * 1000) / 10 : 0;

        currentRound.tournamentPoints[player] = pts;
        currentRound.places[player] = place;
        currentRound.normalizedScores[player] = normalizedScore;

        const display = document.getElementById(`tournament-points-${tournament.currentRound}-${player}`);
        if (display) display.textContent = `→ ${pts} PT (${place}. miejsce, ${normalizedScore}% wyniku zwycięzcy stołu)`;
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
        updatePlayerHistory();
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
        tournament.totalNormalizedScore[p] = 0;
        tournament.highestNormalizedScore[p] = 0;
        tournament.totalTieBreakers[p] = 0;
        tournament.totalTieBreakersByIndex[p] = [0, 0, 0];

        tournament.rounds.forEach(r => {
            const gp = r.scores[p] || 0;
            const tp = r.tournamentPoints[p] || 0;
            const place = r.places ? r.places[p] : undefined;
            const normScore = r.normalizedScores ? (r.normalizedScores[p] || 0) : 0;
            const tbs = normalizeTieBreakers(r.tieBreakers[p]);
            
            tournament.totalTournamentPoints[p] += tp;
            tournament.totalGamePoints[p] += gp;
            tournament.totalNormalizedScore[p] += normScore;
            tournament.totalTieBreakers[p] += tbs.reduce((a, b) => a + b, 0);
            tbs.forEach((v, i) => tournament.totalTieBreakersByIndex[p][i] += v);
            if (place === 1) tournament.firstPlaces[p]++;
            if (gp > tournament.highestSingleScore[p]) tournament.highestSingleScore[p] = gp;
            if (normScore > tournament.highestNormalizedScore[p]) tournament.highestNormalizedScore[p] = normScore;
        });
    });
}

function displaySummary() {
    const summaryDisplay = document.getElementById('summary-display');
    const summaryActions = document.getElementById('summary-actions');

    if (isLeagueMode() && tournament.league.phase === 'weekly-summary') {
        const weekSummary = tournament.league.weekSummaries[tournament.league.currentWeek] || captureCurrentWeekSummary();
        const entries = buildSummaryEntries(weekSummary, weekSummary.rounds || tournament.rounds);

        summaryDisplay.innerHTML = renderSummaryBlock(
            `Podsumowanie dnia - tydzień ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks}`,
            'Wyniki bieżącego tygodnia ligowego.',
            entries
        );
        summaryDisplay.innerHTML += renderLeagueHistory();
        if (summaryActions) {
            summaryActions.innerHTML = `<button onclick="printTournament()" class="btn-tertiary">🖨️ Drukuj</button>
                <button onclick="prepareNextLeagueWeek()" class="btn-primary">Następny tydzień</button>
                <button onclick="resetTournament()" class="btn-secondary">Przerwij ligę</button>
        `;
        }
        tournament.activeSection = 'summary-section';
        return;
    }

    if (isLeagueMode() && tournament.league.phase === 'final-summary') {
        const aggregate = buildLeagueAggregateSummary();
        const leagueRounds = (tournament.league?.weekSummaries || []).flatMap(w => w.rounds || []);
        const entries = buildSummaryEntries(aggregate, leagueRounds);

        summaryDisplay.innerHTML = `
            <div class="league-summary-layout">
                <div class="league-summary-main">
                    ${renderSummaryBlock('Podsumowanie ligi', `Łącznie ${tournament.league.totalWeeks} tygodni gry.`, entries)}
                </div>
                ${renderLeagueBalanceBlock(aggregate, leagueRounds)}
            </div>
            ${renderLeagueHistory()}
        `;
        if (summaryActions) {
            summaryActions.innerHTML = `<button onclick="printTournament()" class="btn-tertiary">🖨️ Drukuj</button>
                <button onclick="resetTournament()" class="btn-secondary">Nowa liga</button>`;
        }
        tournament.activeSection = 'summary-section';
        return;
    }

    const entries = buildSummaryEntries({
        totalTournamentPoints: tournament.totalTournamentPoints,
        totalGamePoints: tournament.totalGamePoints,
        firstPlaces: tournament.firstPlaces,
        highestSingleScore: tournament.highestSingleScore,
        totalNormalizedScore: tournament.totalNormalizedScore,
        highestNormalizedScore: tournament.highestNormalizedScore,
        totalTieBreakers: tournament.totalTieBreakers,
        totalTieBreakersByIndex: tournament.totalTieBreakersByIndex
    });

    summaryDisplay.innerHTML = renderSummaryBlock('🏆 Podsumowanie Turnieju', 'Ranking końcowy turnieju.', entries);
    if (summaryActions) {
        summaryActions.innerHTML = '<button onclick="printTournament()" class="btn-tertiary">🖨️ Drukuj</button><button onclick="resetTournament()" class="btn-secondary">Nowy Turniej</button>';
    }

    tournament.activeSection = 'summary-section';
}

function printTournament() {
    const printWindow = window.open('', 'PRINT', 'height=600,width=900');
    const printContent = generatePrintableContent();
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function generatePrintableContent() {
    const title = tournament.gameName || 'Turniej';
    const subtitle = isLeagueMode() ? `Liga - Tydzień ${tournament.league.currentWeek + 1}/${tournament.league.totalWeeks}` : 'Turniej';
    const date = new Date().toLocaleDateString('pl-PL');
    
    let summaryHtml = '';
    if (isLeagueMode() && tournament.league.phase === 'weekly-summary') {
        const weekSummary = tournament.league.weekSummaries[tournament.league.currentWeek] || captureCurrentWeekSummary();
        const entries = buildSummaryEntries(weekSummary, weekSummary.rounds || tournament.rounds);
        summaryHtml = renderPrintSummaryTable(entries);
    } else if (isLeagueMode() && tournament.league.phase === 'final-summary') {
        const aggregate = buildLeagueAggregateSummary();
        const leagueRounds = (tournament.league?.weekSummaries || []).flatMap(w => w.rounds || []);
        const entries = buildSummaryEntries(aggregate, leagueRounds);
        summaryHtml = renderPrintSummaryTable(entries);
    } else {
        const entries = buildSummaryEntries({
            totalTournamentPoints: tournament.totalTournamentPoints,
            totalGamePoints: tournament.totalGamePoints,
            firstPlaces: tournament.firstPlaces,
            highestSingleScore: tournament.highestSingleScore,
            totalNormalizedScore: tournament.totalNormalizedScore,
            highestNormalizedScore: tournament.highestNormalizedScore,
            totalTieBreakers: tournament.totalTieBreakers,
            totalTieBreakersByIndex: tournament.totalTieBreakersByIndex
        });
        summaryHtml = renderPrintSummaryTable(entries);
    }
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #667eea; margin-bottom: 5px; }
                h2 { color: #764ba2; font-size: 16px; margin-bottom: 10px; }
                .meta { color: #999; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background: #667eea; color: white; padding: 10px; text-align: left; }
                td { padding: 8px; border-bottom: 1px solid #e0e0e0; }
                tr:nth-child(even) { background: #f5f5f5; }
                .rank-1 { background: #ffd700 !important; font-weight: bold; }
                .rank-2 { background: #c0c0c0 !important; font-weight: bold; }
                .rank-3 { background: #cd7f32 !important; color: white; font-weight: bold; }
                @media print { body { padding: 10px; } }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <h2>${subtitle}</h2>
            <p class="meta">Data: ${date} | Liczba graczy: ${tournament.players.length} | Rund: ${tournament.totalRounds}</p>
            ${summaryHtml}
            <p style="margin-top: 30px; font-size: 11px; color: #999;">Wydrukowano z ChemPionship Board Games Tournament Manager</p>
        </body>
        </html>
    `;
}

function renderPrintSummaryTable(entries) {
    let html = '<table><thead><tr><th>#</th><th>Gracz</th><th>PT</th><th>Wygrane</th><th>Pkt Gry</th><th>Wynik znorm.</th><th>Suma TB</th></tr></thead><tbody>';
    entries.forEach((entry, i) => {
        let rowClass = '';
        if (i === 0) rowClass = 'rank-1';
        else if (i === 1) rowClass = 'rank-2';
        else if (i === 2) rowClass = 'rank-3';
        html += `<tr class="${rowClass}"><td>${i + 1}</td><td>${entry.name}</td><td>${entry.tp}</td><td>${entry.wins}</td><td>${entry.gp}</td><td>${entry.gpNorm}%</td><td>${entry.tbs}</td></tr>`;
    });
    html += '</tbody></table>';
    return html;
}

function resetTournament() {
    if (!confirm('Nowy turniej?')) return;

    clearTournamentState();
    location.reload();
}

// Start
loadPlayerHistory();
readTournamentConfig();
if (!loadTournamentState()) {
    updatePlayerList();
}
