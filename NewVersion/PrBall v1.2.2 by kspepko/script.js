// ProjectBall — Новая система поведения и движения бактерий
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
        this.size = 5 + generation;
        this.mutations = mutations;

        this.speed = 1 + Math.random();
        this.direction = Math.random() * 2 * Math.PI;

        this.setDivisionTime();
        this.lastDivision = Date.now();

        this.visionRadius = 75 * Math.pow(1.15, this.generation);
        this.mode = 'wander';
        this.target = this.generateWanderTarget();
        this.travelDistance = Math.sqrt(Math.pow(this.target.x - this.x, 2) + Math.pow(this.target.y - this.y, 2));
        this.nextDecisionTime = Date.now() + Math.random() * 5000 + 1000;
        this.groupedWith = null;
    }

    setDivisionTime() {
        this.divisionTime = (Math.random() * 5 + (this.mutations.includes('fastReproduction') ? 5 : 10)) * 1000;
    }

    generateWanderTarget() {
        const distance = 15 + Math.random() * 185;
        const angle = Math.random() * 2 * Math.PI;
        return {
            x: Math.max(this.size, Math.min(this.x + distance * Math.cos(angle), canvas.width - this.size)),
            y: Math.max(this.size, Math.min(this.y + distance * Math.sin(angle), canvas.height - this.size))
        };
    }

    think() {
        const now = Date.now();
        if (now < this.nextDecisionTime) return;
        this.nextDecisionTime = now + 5000;

        const nearby = bacteria.filter(b => b !== this && this.distanceTo(b) <= this.visionRadius);
        const friends = nearby.filter(b => b.team === this.team);
        const enemies = nearby.filter(b => b.team !== this.team);

        // Враги
        for (const enemy of enemies) {
            if (enemy.generation > this.generation) {
                this.mode = 'flee';
                this.target = { x: this.x + (this.x - enemy.x), y: this.y + (this.y - enemy.y) };
                this.modifySpeed();
                return;
            } else if (enemy.generation < this.generation) {
                this.mode = 'chase';
                this.target = { x: enemy.x, y: enemy.y };
                this.modifySpeed();
                return;
            }
        }

        // Друзья
        if (friends.length > 0) {
            for (const friend of friends) {
                if (friend.generation < this.generation && Math.random() < 0.3) {
                    this.mode = 'follow';
                    this.target = friend;
                    this.followDistance = 15;
                    this.followUntil = now + (5000 + Math.random() * 5000);
                    return;
                }
            }

            if (Math.random() < 0.7) {
                this.mode = 'group';
                const possibleFriends = friends.filter(f => f !== this);
                if (possibleFriends.length > 0) {
                    this.groupedWith = possibleFriends[Math.floor(Math.random() * possibleFriends.length)];
                }
                return;
            } else if (this.mode === 'group' && Math.random() < 0.3) {
                this.mode = 'wander';
                this.groupedWith = null;
            }
        }
    }

    modifySpeed() {
        const rand = Math.random();
        if (rand < 0.3) this.speed *= 1.1;
        else if (rand < 0.5) this.speed *= 1.2;
    }

    distanceTo(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    moveTowards(targetX, targetY, deltaTime) {
        if (isNaN(targetX) || isNaN(targetY)) return false;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return true;

        const nx = dx / dist;
        const ny = dy / dist;

        const inertia = 0.1;
        this.directionX = (this.directionX || nx) * (1 - inertia) + nx * inertia;
        this.directionY = (this.directionY || ny) * (1 - inertia) + ny * inertia;

        const norm = Math.sqrt(this.directionX * this.directionX + this.directionY * this.directionY);
        this.directionX /= norm;
        this.directionY /= norm;

        this.x += this.directionX * this.speed * deltaTime;
        this.y += this.directionY * this.speed * deltaTime;

        if (this.x < this.size || this.x > canvas.width - this.size) this.x = Math.max(this.size, Math.min(this.x, canvas.width - this.size));
        if (this.y < this.size || this.y > canvas.height - this.size) this.y = Math.max(this.size, Math.min(this.y, canvas.height - this.size));

        return dist < 2;
    }

    update(deltaTime) {
        const prevX = this.x;
        const prevY = this.y;
        this.think();

        switch (this.mode) {
            case 'wander':
                const arrived = this.moveTowards(this.target.x, this.target.y, deltaTime);
                if (arrived || this.travelDistance <= 0) {
                    const newTarget = this.generateWanderTarget();
                    this.target = newTarget;
                    this.travelDistance = Math.sqrt(Math.pow(newTarget.x - this.x, 2) + Math.pow(newTarget.y - this.y, 2));
                } else {
                    const dx = this.target.x - this.x;
                    const dy = this.target.y - this.y;
                    this.travelDistance = Math.sqrt(dx * dx + dy * dy);
                }
                break;
            case 'follow':
                if (this.target && Date.now() < this.followUntil) {
                    this.moveTowards(this.target.x, this.target.y, deltaTime);
                } else {
                    this.mode = 'wander';
                    this.target = this.generateWanderTarget();
                }
                break;
            case 'group':
                if (this.groupedWith && this !== this.groupedWith) {
                    const dx = this.groupedWith.x - this.x;
                    const dy = this.groupedWith.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 15) {
                        this.moveTowards(this.groupedWith.x, this.groupedWith.y, deltaTime);
                    } else {
                        const avoidStrength = 0.1 * (1 - dist / 15);
                        this.x -= dx * avoidStrength;
                        this.y -= dy * avoidStrength;
                    }
                } else {
                    this.mode = 'wander';
                    this.target = this.generateWanderTarget();
                }
                break;
            case 'chase':
            case 'flee':
                this.moveTowards(this.target.x, this.target.y, deltaTime);
                break;
        }

        const maxBacteria = parseInt(document.getElementById('maxBacteriaInput').value);
        const teamCount = bacteria.filter(b => b.team === this.team).length;

        if (teamCount < maxBacteria && Date.now() - this.lastDivision >= this.divisionTime) {
            this.divide();
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

        const mutationTypes = ['explosiveDeath', 'fastReproduction', 'fertileDeath'];
        const mutationChance = Math.random();

        const mutate = () => Math.random() < 0.05 ? [mutationTypes[Math.floor(Math.random() * mutationTypes.length)]] : [];

        const b1 = new Bacterium(this.team, x1, y1, this.generation + 1, [...this.mutations, ...mutate()]);
        const b2 = new Bacterium(this.team, x2, y2, this.generation + 1, [...this.mutations, ...mutate()]);

        bacteria.push(b1, b2);
        const index = bacteria.indexOf(this);
        if (index > -1) bacteria.splice(index, 1);
    }

    draw() {
        ctx.fillStyle = this.team;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        if (this.mutations.length > 0) {
            ctx.strokeStyle = this.mutations.includes('explosiveDeath') ? 'rgba(255,0,0,0.5)' :
                              this.mutations.includes('fastReproduction') ? 'rgba(0,255,0,0.5)' :
                              'rgba(0,0,255,0.5)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
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

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bacteria.forEach(b => b.draw());
}

function handleCollisions() {
    const toRemove = new Set();

    for (let i = 0; i < bacteria.length; i++) {
        for (let j = i + 1; j < bacteria.length; j++) {
            const b1 = bacteria[i];
            const b2 = bacteria[j];
            const dx = b1.x - b2.x;
            const dy = b1.y - b2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < b1.size + b2.size) {
                if (b1.team !== b2.team) {
                    if (b1.generation > b2.generation) {
                    toRemove.add(b2);
                    if (b2.mutations.includes('explosiveDeath')) toRemove.add(b1);
                    } else if (b2.generation > b1.generation) {
                    toRemove.add(b1);
                    if (b1.mutations.includes('explosiveDeath')) toRemove.add(b2);
                    } else {
                        toRemove.add(b1);
                        toRemove.add(b2);
                    }
                }
            }
        }
    }

    toRemove.forEach(b => {
        const index = bacteria.indexOf(b);
        if (index !== -1) {
            if (b.mutations.includes('fertileDeath')) {
                for (let i = 0; i < 3; i++) {
                    addBacteria(b.team, 0);
                }
            }


            bacteria.splice(index, 1);
        }
    });
}

function updateFrame(currentTime) {
    const deltaTime = (currentTime - lastFrameTime) / 16.67;
    lastFrameTime = currentTime;
    bacteria.forEach(b => b.update(deltaTime));
    handleCollisions();

    // Автовыход из застывания
    bacteria.forEach(b => {
        const lastPos = b._lastPos || { x: b.x, y: b.y };
        const dx = Math.abs(b.x - lastPos.x);
        const dy = Math.abs(b.y - lastPos.y);

        if (dx < 0.1 && dy < 0.1) {
            const newAngle = Math.random() * 2 * Math.PI;
            b.direction = newAngle;
            b.speed = 1 + Math.random();
            const distance = 15 + Math.random() * 185;
            b.target = {
                x: Math.max(b.size, Math.min(b.x + distance * Math.cos(newAngle), canvas.width - b.size)),
                y: Math.max(b.size, Math.min(b.y + distance * Math.sin(newAngle), canvas.height - b.size))
            };
            b.travelDistance = Math.sqrt(Math.pow(b.target.x - b.x, 2) + Math.pow(b.target.y - b.y, 2));
        }

        b._lastPos = { x: b.x, y: b.y };
    });
    draw();
    requestAnimationFrame(updateFrame);
}

let lastFrameTime = performance.now();
requestAnimationFrame(updateFrame);

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

function restart() {
    bacteria = [];
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

