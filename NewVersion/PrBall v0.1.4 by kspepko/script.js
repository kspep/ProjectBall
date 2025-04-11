const canvas = document.getElementById('gameCanvas');
canvas.style.width = '1200px';
canvas.style.height = '900px';
canvas.width = 1200;
canvas.height = 900;
const ctx = canvas.getContext('2d');

const bacteriaTeams = ['yellow', 'red', 'green', 'blue', 'pink'];
let bacteria = [];

let isKilling = false;
let isDragging = false;
let draggingBacterium = null;
let isRandomSpawnActive = false;
let randomSpawnIntervalId = null;

class Bacterium {
    constructor(team, x, y, generation, mutations = []) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.generation = generation;
        this.size = 5 + generation; // Уменьшено вдвое
        this.mutations = mutations;
        this.speed = 1 + Math.random();
        this.direction = Math.random() * 2 * Math.PI;
        this.setDivisionTime();
        this.lastDivision = Date.now();
    }

    setDivisionTime() {
        if (this.mutations.includes('fastReproduction')) {
            this.divisionTime = (Math.random() * 5 + 5) * 1000;
        } else {
            this.divisionTime = (Math.random() * 5 + 10) * 1000;
        }
    }

    draw() {
        ctx.fillStyle = this.team;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        if (this.mutations.includes('explosiveDeath')) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        } else if (this.mutations.includes('fastReproduction')) {
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        } else if (this.mutations.includes('fertileDeath')) {
            ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        }

        if (this.mutations.length > 0) {
            ctx.lineWidth = 1.5; // Уменьшено вдвое
            ctx.stroke();
        }
    }

    update(deltaTime) {
        if (draggingBacterium !== this) {
            this.x += this.speed * Math.cos(this.direction) * deltaTime;
            this.y += this.speed * Math.sin(this.direction) * deltaTime;

            if (this.x < this.size || this.x > canvas.width - this.size) {
                this.direction = Math.PI - this.direction;
            }
            if (this.y < this.size || this.y > canvas.height - this.size) {
                this.direction = -this.direction;
            }

            if (this.speed > 1.3) {
                this.speed = 1.3;
            }

            const maxBacteria = parseInt(document.getElementById('maxBacteriaInput').value);
            const teamCount = bacteria.filter(b => b.team === this.team).length;

            if (teamCount < maxBacteria && Date.now() - this.lastDivision >= this.divisionTime) {
                this.divide();
            }
        }
    }

    divide() {
        this.lastDivision = Date.now();
        this.setDivisionTime();
        const offset = this.size * 2;
        const angle = Math.random() * 2 * Math.PI;
        const x1 = this.x + offset * Math.cos(angle);
        const y1 = this.y + offset * Math.sin(angle);
        const x2 = this.x - offset * Math.cos(angle);
        const y2 = this.y - offset * Math.sin(angle);

        const mutationChance = Math.random();
        let mutations1 = [...this.mutations];
        let mutations2 = [...this.mutations];

        if (mutationChance < 0.05) {
            const mutationTypes = ['explosiveDeath', 'fastReproduction', 'fertileDeath'];
            const newMutation = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
            mutations1.push(newMutation);
        }

        if (mutationChance < 0.05) {
            const mutationTypes = ['explosiveDeath', 'fastReproduction', 'fertileDeath'];
            const newMutation = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
            mutations2.push(newMutation);
        }

        const newBacterium1 = new Bacterium(this.team, x1, y1, this.generation + 1, mutations1);
        const newBacterium2 = new Bacterium(this.team, x2, y2, this.generation + 1, mutations2);

        bacteria.push(newBacterium1, newBacterium2);

        const index = bacteria.indexOf(this);
        if (index > -1) {
            bacteria.splice(index, 1);
        }
    }
}

function addBacteria(team, generation = 0, mutation = '') {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const mutations = mutation ? [mutation] : [];
    const newBacteria = new Bacterium(team, x, y, generation, mutations);
    bacteria.push(newBacteria);
}

function spawnBacterium() {
    const team = document.getElementById('teamSelect').value;
    const generation = parseInt(document.getElementById('generationInput').value);
    const mutation = document.getElementById('mutationSelect').value;
    addBacteria(team, generation, mutation);
}

function spawnAllTeams() {
    const generation = parseInt(document.getElementById('generationInput').value);
    const mutation = document.getElementById('mutationSelect').value;
    bacteriaTeams.forEach(team => addBacteria(team, generation, mutation));
}

function handleCollisions() {
    const toRemove = [];

    for (let i = 0; i < bacteria.length; i++) {
        for (let j = i + 1; j < bacteria.length; j++) {
            const b1 = bacteria[i];
            const b2 = bacteria[j];

            const dx = b1.x - b2.x;
            const dy = b1.y - b2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < b1.size + b2.size) {
                if (b1.team === b2.team) {
                    const angle = Math.atan2(dy, dx);
                    const totalSpeed = b1.speed + b2.speed;
                    const b1Move = b2.speed / totalSpeed;
                    const b2Move = b1.speed / totalSpeed;

                    b1.x += b1Move * Math.cos(angle);
                    b1.y += b1Move * Math.sin(angle);

                    b2.x -= b2Move * Math.cos(angle);
                    b2.y -= b2Move * Math.sin(angle);
                } else {
                    if (b1.generation > b2.generation) {
                        toRemove.push(b2);
                        if (b2.mutations.includes('explosiveDeath')) {
                            toRemove.push(b1);
                        }
                    } else if (b1.generation < b2.generation) {
                        toRemove.push(b1);
                        if (b1.mutations.includes('explosiveDeath')) {
                            toRemove.push(b2);
                        }
                    } else {
                        toRemove.push(b1, b2);
                    }
                }
            }
        }
    }

    toRemove.forEach(b => {
        const index = bacteria.indexOf(b);
        if (index > -1) {
            if (b.mutations.includes('fertileDeath')) {
                for (let i = 0; i < 3; i++) {
                    addBacteria(b.team, 0);
                }
            }
            bacteria.splice(index, 1);
        }
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bacteria.forEach(b => b.draw());
}

let lastFrameTime = performance.now();
function update(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) / 16.67;
    lastFrameTime = currentTime;
    bacteria.forEach(b => b.update(deltaTime));
    handleCollisions();
    draw();
    requestAnimationFrame(update);
}

function debugFrameTime(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    console.log(`Frame time: ${deltaTime.toFixed(2)} ms`);
    lastFrameTime = currentTime;
    requestAnimationFrame(debugFrameTime);
}

function getMousePos(evt) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (evt.clientX - rect.left) * scaleX,
        y: (evt.clientY - rect.top) * scaleY
    };
}

function restart() {
    bacteria = [];
}

canvas.addEventListener('mousedown', (e) => {
    const { x: mouseX, y: mouseY } = getMousePos(e);

    if (isKilling) {
        bacteria = bacteria.filter(b => {
            const dx = b.x - mouseX;
            const dy = b.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) > b.size;
        });
    } else if (isDragging) {
        draggingBacterium = bacteria.find(b => {
            const dx = b.x - mouseX;
            const dy = b.y - mouseY;
            return Math.sqrt(dx * dx + dy * dy) <= b.size;
        });
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (draggingBacterium) {
        const { x, y } = getMousePos(e);
        draggingBacterium.x = x;
        draggingBacterium.y = y;
    }
});

canvas.addEventListener('mouseup', () => {
    draggingBacterium = null;
});

document.getElementById('killButton').addEventListener('click', (e) => {
    isKilling = !isKilling;
    e.target.classList.toggle('active', isKilling);
    if (isKilling) {
        isDragging = false;
        document.getElementById('dragButton').classList.remove('active');
    }
});

document.getElementById('dragButton').addEventListener('click', (e) => {
    isDragging = !isDragging;
    e.target.classList.toggle('active', isDragging);
    if (isDragging) {
        isKilling = false;
        document.getElementById('killButton').classList.remove('active');
    }
});

document.getElementById('randomSpawnButton').addEventListener('click', (e) => {
    isRandomSpawnActive = !isRandomSpawnActive;
    e.target.classList.toggle('active', isRandomSpawnActive);
    if (isRandomSpawnActive) {
        const interval = parseInt(document.getElementById('spawnIntervalInput').value) * 1000;
        randomSpawnIntervalId = setInterval(() => {
            const team = bacteriaTeams[Math.floor(Math.random() * bacteriaTeams.length)];
            addBacteria(team);
        }, interval);
    } else {
        clearInterval(randomSpawnIntervalId);
    }
});

requestAnimationFrame(update);
requestAnimationFrame(debugFrameTime);

