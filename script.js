// Stan aplikacji
let tournament = {
    gameName: '',
    players: [],
    currentRound: 0,
    rounds: [
        { tables: [], scores: {}, tournamentPoints: {} },
        { tables: [], scores: {}, tournamentPoints: {} }
    ],
    totalTournamentPoints: {},
    totalGamePoints: {},
    firstPlaces: {},
    highestSingleScore: {}
};

// Wybór gry
function selectGame() {
    const gameInput = document.getElementById('game-name');
    const gameName = gameInput.value.trim();
    
    if (!gameName) {
        alert('Wprowadź nazwę gry!');
        return;
    }
    
    tournament.gameName = gameName;
    
    document.getElementById('selected-game').innerHTML = `
        <strong>Wybrana gra:</strong> ${gameName}
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
    if (tournament.players.length < 2) {
        alert('Potrzebujesz co najmniej 2 graczy!');
        return;
    }
    
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
    
    // Podział na stoły (preferowane 4-osobowe, dopuszczalne 3-osobowe)
    tournament.rounds[roundIndex].tables = [];
    const totalPlayers = shuffledPlayers.length;
    let tableNumber = 1;
    let currentIndex = 0;
    
    // Oblicz optymalny podział
    const remainder = totalPlayers % 4;
    let fourPlayerTables;
    let threePlayerTables = 0;
    
    if (remainder === 0) {
        // Wszystkie stoły 4-osobowe
        fourPlayerTables = totalPlayers / 4;
    } else if (remainder === 1) {
        // Zostaje 1 gracz - robimy dwa stoły 3-osobowe zamiast jednego 4-osobowego i jednego 1-osobowego
        fourPlayerTables = Math.floor(totalPlayers / 4) - 1;
        threePlayerTables = 2;
    } else if (remainder === 2) {
        // Zostają 2 graczy - robimy dwa stoły 3-osobowe zamiast jednego 4-osobowego i jednego 2-osobowego
        fourPlayerTables = Math.floor(totalPlayers / 4) - 1;
        threePlayerTables = 2;
    } else if (remainder === 3) {
        // Zostają 3 graczy - jeden stół 3-osobowy
        fourPlayerTables = Math.floor(totalPlayers / 4);
        threePlayerTables = 1;
    }
    
    // Twórz stoły 4-osobowe
    for (let i = 0; i < fourPlayerTables; i++) {
        const tablePlayers = shuffledPlayers.slice(currentIndex, currentIndex + 4);
        tournament.rounds[roundIndex].tables.push({
            tableNumber: tableNumber++,
            players: tablePlayers
        });
        currentIndex += 4;
    }
    
    // Twórz stoły 3-osobowe
    for (let i = 0; i < threePlayerTables; i++) {
        const tablePlayers = shuffledPlayers.slice(currentIndex, currentIndex + 3);
        tournament.rounds[roundIndex].tables.push({
            tableNumber: tableNumber++,
            players: tablePlayers
        });
        currentIndex += 3;
    }
}

function generateNonRepeatingTables() {
    // Pobierz pary z pierwszej rundy
    const firstRoundPairs = new Set();
    tournament.rounds[0].tables.forEach(table => {
        for (let i = 0; i < table.players.length; i++) {
            for (let j = i + 1; j < table.players.length; j++) {
                const pair = [table.players[i], table.players[j]].sort().join('|');
                firstRoundPairs.add(pair);
            }
        }
    });
    
    // Oblicz struktur stołów (która będzie taka sama jak w rundzie 1)
    const totalPlayers = tournament.players.length;
    const remainder = totalPlayers % 4;
    let tableStructure = [];
    
    if (remainder === 0) {
        for (let i = 0; i < totalPlayers / 4; i++) tableStructure.push(4);
    } else if (remainder === 1 || remainder === 2) {
        for (let i = 0; i < Math.floor(totalPlayers / 4) - 1; i++) tableStructure.push(4);
        tableStructure.push(3, 3);
    } else if (remainder === 3) {
        for (let i = 0; i < Math.floor(totalPlayers / 4); i++) tableStructure.push(4);
        tableStructure.push(3);
    }
    
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
                    if (firstRoundPairs.has(pair)) repeats++;
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
        <h3 style="color: #764ba2; margin-bottom: 15px;">Runda ${tournament.currentRound + 1}/2</h3>
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
    finishBtn.textContent = tournament.currentRound === 0 ? 'Następna Runda' : 'Zakończ Turniej';
}

function displayScoringSection() {
    const scoringDisplay = document.getElementById('scoring-display');
    const currentRound = tournament.rounds[tournament.currentRound];
    
    scoringDisplay.innerHTML = `
        <h3 style="color: #764ba2; margin-bottom: 20px;">Runda ${tournament.currentRound + 1}/2 - Wprowadź punkty z gier</h3>
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

function calculateTablePoints(tableIndex) {
    const currentRound = tournament.rounds[tournament.currentRound];
    const table = currentRound.tables[tableIndex];
    
    // Sprawdź czy wszystkie wyniki są wprowadzone
    const allScores = table.players.every(player => 
        currentRound.scores[player] !== undefined && currentRound.scores[player] > 0
    );
    
    if (!allScores) {
        alert('Wprowadź punkty dla wszystkich graczy przy tym stole!');
        return;
    }
    
    // Posortuj graczy według punktów (malejąco)
    const sortedPlayers = [...table.players].sort((a, b) => 
        currentRound.scores[b] - currentRound.scores[a]
    );
    
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
    
    if (tournament.currentRound === 0) {
        // Przejdź do drugiej rundy
        tournament.currentRound = 1;
        generateRoundTables(1);
        displayTables();
        
        // Wyświetl wyniki pierwszej rundy
        showRoundSummary(0);
        
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
        tournamentPoints: round.tournamentPoints[player] || 0
    })).sort((a, b) => b.tournamentPoints - a.tournamentPoints || b.gamePoints - a.gamePoints);
    
    const message = `Wyniki rundy ${roundIndex + 1}:\n\n` +
        players.map((p, i) => `${i + 1}. ${p.name}: ${p.tournamentPoints} pkt turniejowych (${p.gamePoints} pkt z gry)`).join('\n') +
        '\n\nKliknij OK, aby rozpocząć rundę 2.';
    
    alert(message);
}

function calculateFinalResults() {
    // Sumuj punkty turniejowe i punkty z gier
    tournament.players.forEach(player => {
        tournament.totalTournamentPoints[player] = 
            (tournament.rounds[0].tournamentPoints[player] || 0) +
            (tournament.rounds[1].tournamentPoints[player] || 0);
        
        tournament.totalGamePoints[player] = 
            (tournament.rounds[0].scores[player] || 0) +
            (tournament.rounds[1].scores[player] || 0);
        
        // Policz zwycięstwa (ile razy zajął 1. miejsce przy stole)
        tournament.firstPlaces[player] = 
            (tournament.rounds[0].tournamentPoints[player] === 3 ? 1 : 0) +
            (tournament.rounds[1].tournamentPoints[player] === 3 ? 1 : 0);
        
        // Najwyższy pojedynczy wynik
        tournament.highestSingleScore[player] = Math.max(
            tournament.rounds[0].scores[player] || 0,
            tournament.rounds[1].scores[player] || 0
        );
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
            round1GamePoints: tournament.rounds[0].scores[player] || 0,
            round1TournamentPoints: tournament.rounds[0].tournamentPoints[player] || 0,
            round2GamePoints: tournament.rounds[1].scores[player] || 0,
            round2TournamentPoints: tournament.rounds[1].tournamentPoints[player] || 0
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
            return b.highestScore - a.highestScore;
        });
    
    // Statystyki
    const totalPlayers = tournament.players.length;
    const totalRounds = 2;
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
                            <td><strong>${player.tournamentPoints}</strong> (${player.round1TournamentPoints} + ${player.round2TournamentPoints})</td>
                            <td>${player.firstPlaces}</td>
                            <td>${player.gamePoints} (${player.round1GamePoints} + ${player.round2GamePoints})</td>
                            <td>${player.highestScore}</td>
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
                W przypadku remisu w klasyfikacji końcowej decydują: liczba zwycięstw, 
                łączne punkty z gier, najwyższy pojedynczy wynik.
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
            rounds: [
                { tables: [], scores: {}, tournamentPoints: {} },
                { tables: [], scores: {}, tournamentPoints: {} }
            ],
            totalTournamentPoints: {},
            totalGamePoints: {},
            firstPlaces: {},
            highestSingleScore: {}
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
        
        // Wyczyść wyświetlane dane
        updatePlayerList();
    }
}

// Inicjalizacja
updatePlayerList();
