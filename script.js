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
    totalTieBreakers: {}
};

function createRounds(totalRounds) {
    return Array.from({ length: totalRounds }, () => ({
        tables: [],
        scores: {},
        tieBreakers: {},
        tournamentPoints: {}
    }));
}

function readTournamentConfig() {
    const roundInput = document.getElementById('round-count');
    const tableSizeInput = document.getElementById('preferred-table-size');

    const rounds = Math.max(1, Math.min(10, parseInt(roundInput?.value, 10) || 2));
    const preferredSize = Math.max(3, Math.min(8, parseInt(tableSizeInput?.value, 10) || 4));

    tournament.totalRounds = rounds;
    tournament.preferredTableSize = preferredSize;
}

// Wybór gry
function selectGame() {
    const gameInput = document.getElementById('game-name');
    const gameName = gameInput.value.trim();
    
    if (!gameName) {
        alert('Wprowadź nazwę gry!');
        return;
    }
    
    tournament.gameName = gameName;
    readTournamentConfig();
    if (tournament.gameName) {
        document.getElementById('selected-game').innerHTML = `
            <strong>Wybrana gra:</strong> ${tournament.gameName}<br>
            <span style="color:#667eea; font-weight: 500;">Rundy: ${tournament.totalRounds} · Preferowany stół: ${tournament.preferredTableSize} osoby</span>
        `;
    }
    
    document.getElementById('selected-game').innerHTML = `
        <strong>Wybrana gra:</strong> ${gameName}<br>
        <span style="color:#667eea; font-weight: 500;">Rundy: ${tournament.totalRounds} · Preferowany stół: ${tournament.preferredTableSize} osoby</span>
    `;
    
    // Pokaż sekcję graczy
    document.getElementById('player-section').classList.add('active');
    gameInput.value = '';
}

// Dodawanie graczy
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

// Generowanie stołów
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
        // Pierwsza runda - losuj swobodnie
        shuffledPlayers = [...tournament.players].sort(() => Math.random() - 0.5);
    } else {
        // Druga runda - unikaj powtórzeń
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
    const sizes = Array.from({ length: tableCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));

    return sizes;
}

function generateNonRepeatingTables() {
    // Pobierz pary ze wszystkich poprzednich rund
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
    
    const totalPlayers = tournament.players.length;
    const tableStructure = calculateTableStructure(totalPlayers, tournament.preferredTableSize);
    
    // Próbuj losować stoły minimalizując powtórzenia
    let bestArrangement = null;
    let minRepeats = Infinity;
    
    for (let attempt = 0; attempt < 100; attempt++) {
        const shuffled = [...tournament.players].sort(() => Math.random() - 0.5);
        let repeats = 0;
        let currentIndex = 0;
        
        // Sprawdź powtórzenia dla tej konfiguracji
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

function regenerateTables() {
    generateRoundTables(tournament.currentRound);
    displayTables();
}

function displayTables() {
    const tablesDisplay = document.getElementById('tables-display');
    const currentRoundTables = tournament.rounds[tournament.currentRound].tables;
    
    tablesDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 15px;">Runda ${tournament.currentRound + 1}/${tournament.totalRounds}</h3>
        ${currentRoundTables.map(table => `
            <div class="table">
                <h3>Stół ${table.tableNumber}</h3>
                <div class="table-players">
                    ${table.players.map(player => `
                        <div class="table-player">${player}</div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
}

// Rozpoczęcie punktacji
function startScoring() {
    displayScoringSection();
    document.getElementById('scoring-section').classList.add('active');
    const finishBtn = document.getElementById('finish-btn');
    finishBtn.style.display = 'block';
    // Zmień tekst przycisku w zależności od rundy
    finishBtn.textContent = tournament.currentRound < tournament.totalRounds - 1 ? 'Następna Runda' : 'Zakończ Turniej';
}

function displayScoringSection() {
    const scoringDisplay = document.getElementById('scoring-display');
    const currentRound = tournament.rounds[tournament.currentRound];

    currentRound.tables.forEach(table => {
        table.players.forEach(player => {
            if (currentRound.scores[player] === undefined) currentRound.scores[player] = 0;
            if (currentRound.tieBreakers[player] === undefined) currentRound.tieBreakers[player] = 0;
        });
    });
    
    scoringDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 20px;">Runda ${tournament.currentRound + 1}/${tournament.totalRounds} - Wprowadź punkty z gier</h3>
        ${currentRound.tables.map(table => `
            <div class="scoring-table">
                <h3>Stół ${table.tableNumber}</h3>
                ${table.players.map(player => `
                    <div class="score-input-group">
                        <label>${player}:</label>
                        <input type="number" 
                               id="score-${tournament.currentRound}-${player}" 
                               value="${currentRound.scores[player] || 0}"
                               min="0"
                               onchange="updateScore('${player}', this.value)"
                               placeholder="Punkty z gry">
                        <input type="number"
                               id="tiebreaker-${tournament.currentRound}-${player}"
                               value="${currentRound.tieBreakers[player] || 0}"
                               min="0"
                               onchange="updateTieBreaker('${player}', this.value)"
                               placeholder="Tie-breaker">
                        <span id="tournament-points-${tournament.currentRound}-${player}" style="color: #764ba2; font-weight: bold; min-width: 60px;"></span>
                    </div>
                `).join('')}
                <button onclick="calculateTablePoints(${table.tableNumber - 1})" style="margin-top: 10px; width: 100%;">
                    Przelicz punkty turniejowe
                </button>
            </div>
        `).join('')}
    `;
}

function updateScore(player, score) {
    const currentRound = tournament.rounds[tournament.currentRound];
    currentRound.scores[player] = parseInt(score) || 0;
}

function updateTieBreaker(player, value) {
    const currentRound = tournament.rounds[tournament.currentRound];
    currentRound.tieBreakers[player] = parseInt(value) || 0;
}

function calculateTablePoints(tableIndex) {
    const currentRound = tournament.rounds[tournament.currentRound];
    const table = currentRound.tables[tableIndex];
    
    // Sprawdź czy wszystkie wyniki są wprowadzone
    const allScores = table.players.every(player => 
        currentRound.scores[player] !== undefined
    );
    const allTieBreakers = table.players.every(player => 
        currentRound.tieBreakers[player] !== undefined
    );
    
    if (!allScores || !allTieBreakers) {
        alert('Wprowadź punkty i tie-breakery dla wszystkich graczy przy tym stole!');
        return;
    }
    
    // Posortuj graczy według punktów (malejąco), a przy remisie po tie-breakerach
    const sortedPlayers = [...table.players].sort((a, b) => {
        const scoreDiff = currentRound.scores[b] - currentRound.scores[a];
        if (scoreDiff !== 0) return scoreDiff;
        const tieDiff = (currentRound.tieBreakers[b] || 0) - (currentRound.tieBreakers[a] || 0);
        if (tieDiff !== 0) return tieDiff;
        return a.localeCompare(b);
    });
    
    // Przyznaj punkty turniejowe: 3, 2, 1, 0
    const tournamentPointsMap = [3, 2, 1, 0];
    
    sortedPlayers.forEach((player, index) => {
        const points = tournamentPointsMap[index] || 0;
        currentRound.tournamentPoints[player] = points;
        
        // Wyświetl punkty turniejowe
        const displayElement = document.getElementById(`tournament-points-${tournament.currentRound}-${player}`);
        if (displayElement) {
            displayElement.textContent = `→ ${points} pkt turniejowych`;
        }
    });
    
    alert(`Punkty turniejowe dla stołu ${table.tableNumber} zostały przyznane!`);
}

// Zakończenie turnieju i podsumowanie
function finishTournament() {
    const currentRound = tournament.rounds[tournament.currentRound];
    
    // Sprawdź czy wszystkie stoły mają przeliczone punkty turniejowe
    const allTablesCalculated = tournament.players.every(player => 
        currentRound.tournamentPoints[player] !== undefined
    );
    
    if (!allTablesCalculated) {
        alert('Przelicz punkty turniejowe dla wszystkich stołów przed zakończeniem rundy!');
        return;
    }
    
    if (tournament.currentRound < tournament.totalRounds - 1) {
        // Przejdź do kolejnej rundy
        const finishedRound = tournament.currentRound;
        tournament.currentRound += 1;
        generateRoundTables(tournament.currentRound);
        displayTables();

        // Wyświetl wyniki zakończonej rundy
        showRoundSummary(finishedRound);

        // Wróć do sekcji stołów
        document.getElementById('scoring-section').classList.remove('active');
        document.getElementById('finish-btn').style.display = 'none';
        document.getElementById('start-scoring-btn').style.display = 'block';
    } else {
        // Zakończ turniej - pokaż finalne podsumowanie
        calculateFinalResults();
        displaySummary();
        document.getElementById('summary-section').classList.add('active');
    }
}

function showRoundSummary(roundIndex) {
    const round = tournament.rounds[roundIndex];
    const players = tournament.players.map(player => ({
        name: player,
        gamePoints: round.scores[player] || 0,
        tournamentPoints: round.tournamentPoints[player] || 0,
        tieBreaker: round.tieBreakers[player] || 0
    })).sort((a, b) => b.tournamentPoints - a.tournamentPoints || b.gamePoints - a.gamePoints || b.tieBreaker - a.tieBreaker);
    
    const nextRoundNumber = roundIndex + 2;
    const message = `Wyniki rundy ${roundIndex + 1}:\n\n` +
        players.map((p, i) => `${i + 1}. ${p.name}: ${p.tournamentPoints} pkt turniejowych (${p.gamePoints} pkt z gry, TB ${p.tieBreaker})`).join('\n') +
        `\n\nKliknij OK, aby rozpocząć rundę ${nextRoundNumber}.`;
    
    alert(message);
}

function calculateFinalResults() {
    // Sumuj punkty turniejowe, punkty z gier i tie-breakery
    tournament.players.forEach(player => {
        tournament.totalTournamentPoints[player] = 0;
        tournament.totalGamePoints[player] = 0;
        tournament.firstPlaces[player] = 0;
        tournament.highestSingleScore[player] = 0;
        tournament.totalTieBreakers[player] = 0;

        tournament.rounds.forEach(round => {
            const gamePoints = round.scores[player] || 0;
            const tournamentPoints = round.tournamentPoints[player] || 0;
            const tieBreaker = round.tieBreakers[player] || 0;

            tournament.totalTournamentPoints[player] += tournamentPoints;
            tournament.totalGamePoints[player] += gamePoints;
            tournament.totalTieBreakers[player] += tieBreaker;

            if (tournamentPoints === 3) {
                tournament.firstPlaces[player] += 1;
            }

            if (gamePoints > tournament.highestSingleScore[player]) {
                tournament.highestSingleScore[player] = gamePoints;
            }
        });
    });
}

function displaySummary() {
    const summaryDisplay = document.getElementById('summary-display');
    
    // Sortowanie graczy według tie-breakerów
    const sortedPlayers = tournament.players
        .map(player => ({
            name: player,
            tournamentPoints: tournament.totalTournamentPoints[player],
            gamePoints: tournament.totalGamePoints[player],
            firstPlaces: tournament.firstPlaces[player],
            highestScore: tournament.highestSingleScore[player],
            totalTieBreakers: tournament.totalTieBreakers[player],
            roundGamePoints: tournament.rounds.map(round => round.scores[player] || 0),
            roundTournamentPoints: tournament.rounds.map(round => round.tournamentPoints[player] || 0),
            roundTieBreakers: tournament.rounds.map(round => round.tieBreakers[player] || 0)
        }))
        .sort((a, b) => {
            // 1. Punkty turniejowe
            if (b.tournamentPoints !== a.tournamentPoints) 
                return b.tournamentPoints - a.tournamentPoints;
            // 2. Liczba zwycięstw
            if (b.firstPlaces !== a.firstPlaces) 
                return b.firstPlaces - a.firstPlaces;
            // 3. Łączne punkty z gier
            if (b.gamePoints !== a.gamePoints) 
                return b.gamePoints - a.gamePoints;
            // 4. Najwyższy pojedynczy wynik
            if (b.highestScore !== a.highestScore)
                return b.highestScore - a.highestScore;
            // 5. Suma tie-breakerów
            return b.totalTieBreakers - a.totalTieBreakers;
        });
    
    // Statystyki
    const totalPlayers = tournament.players.length;
    const totalRounds = tournament.totalRounds;
    const avgTournamentPoints = sortedPlayers.reduce((sum, p) => sum + p.tournamentPoints, 0) / totalPlayers;
    
    summaryDisplay.innerHTML = `
        <div class="stats-box">
            <div class="stat-item">
                <div class="stat-label">Gra</div>
                <div class="stat-value">${tournament.gameName}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Gracze</div>
                <div class="stat-value">${totalPlayers}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Rundy</div>
                <div class="stat-value">${totalRounds}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">Śr. pkt turniejowych</div>
                <div class="stat-value">${avgTournamentPoints.toFixed(1)}</div>
            </div>
        </div>
        
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Miejsce</th>
                    <th>Gracz</th>
                    <th>Pkt turniejowe</th>
                    <th>Zwycięstwa</th>
                    <th>Pkt z gier</th>
                    <th>Najwyższy wynik</th>
                    <th>Suma TB</th>
                </tr>
            </thead>
            <tbody>
                ${sortedPlayers.map((player, index) => {
                    let rankClass = '';
                    let medal = '';
                    
                    if (index === 0) {
                        rankClass = 'rank-1';
                        medal = '<span class="medal">🥇</span>';
                    } else if (index === 1) {
                        rankClass = 'rank-2';
                        medal = '<span class="medal">🥈</span>';
                    } else if (index === 2) {
                        rankClass = 'rank-3';
                        medal = '<span class="medal">🥉</span>';
                    }
                    
                    return `
                        <tr class="${rankClass}">
                            <td>${medal}${index + 1}</td>
                            <td>${player.name}</td>
                            <td><strong>${player.tournamentPoints}</strong> (${player.roundTournamentPoints.join(' + ')})</td>
                            <td>${player.firstPlaces}</td>
                            <td>${player.gamePoints} (${player.roundGamePoints.join(' + ')})</td>
                            <td>${player.highestScore}</td>
                            <td>${player.totalTieBreakers} (${player.roundTieBreakers.join(' + ')})</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        
        <div style="margin-top: 30px; padding: 20px; background: #f0f4ff; border-radius: 8px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">Zasady punktacji turnieju</h3>
            <ul style="margin-left: 20px; line-height: 1.8;">
                <li><strong>1. miejsce przy stole:</strong> 3 pkt turniejowe</li>
                <li><strong>2. miejsce przy stole:</strong> 2 pkt turniejowe</li>
                <li><strong>3. miejsce przy stole:</strong> 1 pkt turniejowy</li>
                <li><strong>4. miejsce przy stole:</strong> 0 pkt turniejowych</li>
            </ul>
            <p style="margin-top: 15px; font-style: italic; color: #666;">
                Miejsca przy stole określane są na podstawie punktów zdobytych w grze.
                W przypadku remisu w punktach przy stole decyduje tie-breaker.
                W przypadku remisu w klasyfikacji końcowej decydują: liczba zwycięstw, 
                łączne punkty z gier, najwyższy pojedynczy wynik, suma tie-breakerów.
            </p>
        </div>
    `;
}

// Reset turnieju
function resetTournament() {
    if (confirm('Czy na pewno chcesz rozpocząć nowy turniej? Wszystkie dane zostaną utracone.')) {
        tournament = {
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
            totalTieBreakers: {}
        };
        
        // Ukryj wszystkie sekcje oprócz pierwszej
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById('game-selection').classList.add('active');
        
        // Wyczyść pola
        document.getElementById('game-name').value = '';
        document.getElementById('player-name').value = '';
        document.getElementById('selected-game').innerHTML = '';
        document.getElementById('round-count').value = '2';
        document.getElementById('preferred-table-size').value = '4';
        
        // Wyczyść wyświetlane dane
        updatePlayerList();
    }
}

// Inicjalizacja
readTournamentConfig();
tournament.rounds = createRounds(tournament.totalRounds);
updatePlayerList();
