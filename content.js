class WebDoggy {
  constructor() {
    this.doggy = null;
    this.active = false;
    this.position = { x: 100, y: 100 };
    this.velocity = { x: 2, y: 0 };
    this.currentActivity = 'idle';
    this.activityTimer = null;
    this.animationFrame = null;
    this.isFlipped = false;
    this.isDragging = false;
    this.ladders = [];
    this.blocks = [];
    this.commandMenu = null;
    this.stolenTexts = [];
    this.groundLevel = 0;
    this.isClimbing = false;
    this.targetPosition = null;
    
    this.activities = ['walk', 'sniff', 'dig', 'bark', 'sit'];
    this.setupMessageListener();
    this.setupClickListener();
    this.setupKeyboardListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'summonDoggy') {
        this.summon();
        sendResponse({ success: true });
      } else if (request.action === 'dismissDoggy') {
        this.dismiss();
        sendResponse({ success: true });
      } else if (request.action === 'checkDoggy') {
        sendResponse({ active: this.active });
      }
      return true;
    });
  }

  setupClickListener() {
    document.addEventListener('click', (e) => {
      if (!this.active || this.isDragging) return;
      
      if (e.ctrlKey && e.shiftKey) {
        this.callDoggyTo(e.pageX, e.pageY);
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (!this.active) return;
      
      if (e.target.classList.contains('web-doggy')) {
        e.preventDefault();
        this.showCommandMenu(e.pageX, e.pageY);
      }
    });
  }

  setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (!this.active) return;
      
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.createLadder();
      } else if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        this.createBlock();
      }
    });

    let typingBuffer = '';
    let typingTimeout = null;
    
    document.addEventListener('keypress', (e) => {
      if (!this.active || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      clearTimeout(typingTimeout);
      typingBuffer += e.key;
      
      typingTimeout = setTimeout(() => {
        if (typingBuffer.length > 3 && Math.random() < 0.3) {
          this.stealText(typingBuffer);
        }
        typingBuffer = '';
      }, 500);
    });
  }

  summon() {
    if (this.active) return;
    
    this.active = true;
    this.doggy = document.createElement('div');
    this.doggy.className = 'web-doggy';
    this.doggy.textContent = '🐕';
    this.doggy.style.left = this.position.x + 'px';
    this.doggy.style.top = this.position.y + 'px';
    
    this.setupDragAndDrop();
    document.body.appendChild(this.doggy);
    
    this.startBehavior();
  }

  dismiss() {
    if (!this.active) return;
    
    this.active = false;
    cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.activityTimer);
    
    if (this.doggy) {
      this.doggy.remove();
      this.doggy = null;
    }
    
    if (this.commandMenu) {
      this.commandMenu.remove();
      this.commandMenu = null;
    }
    
    this.ladders.forEach(l => l.remove());
    this.blocks.forEach(b => b.remove());
    this.stolenTexts.forEach(t => t.remove());
    this.ladders = [];
    this.blocks = [];
    this.stolenTexts = [];
  }

  setupDragAndDrop() {
    let offsetX, offsetY;
    
    this.doggy.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.doggy.classList.add('dragging');
      offsetX = e.clientX - this.position.x;
      offsetY = e.clientY - this.position.y;
      this.stopActivity();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      this.position.x = e.clientX - offsetX;
      this.position.y = e.clientY - offsetY;
      this.updatePosition();
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.doggy.classList.remove('dragging');
        this.startRandomActivity();
      }
    });
  }

  startBehavior() {
    this.startRandomActivity();
    this.updateLoop();
  }

  updateLoop() {
    if (!this.active) return;
    
    if (this.currentActivity === 'walk' && !this.isDragging) {
      this.walk();
    } else if (this.targetPosition && !this.isDragging) {
      this.moveToTarget();
    }
    
    this.animationFrame = requestAnimationFrame(() => this.updateLoop());
  }

  walk() {
    this.position.x += this.velocity.x;
    
    const element = this.getElementBelow();
    if (element) {
      const rect = element.getBoundingClientRect();
      this.groundLevel = rect.top + window.scrollY;
      this.position.y = this.groundLevel - 35;
    } else {
      this.position.y += 2;
    }
    
    if (this.position.x > window.innerWidth - 50 || this.position.x < 0) {
      this.velocity.x *= -1;
      this.flip();
    }
    
    if (this.position.y > window.innerHeight + window.scrollY - 50) {
      this.position.y = window.innerHeight + window.scrollY - 50;
    }
    
    this.updatePosition();
  }

  getElementBelow() {
    const elements = document.elementsFromPoint(
      this.position.x + 20,
      this.position.y + 40 - window.scrollY
    );
    
    for (let el of elements) {
      if (el !== this.doggy && 
          !el.classList.contains('doggy-ladder') && 
          !el.classList.contains('doggy-block') &&
          el.offsetHeight > 0) {
        return el;
      }
    }
    return null;
  }

  flip() {
    this.isFlipped = !this.isFlipped;
    this.doggy.style.transform = this.isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
  }

  startRandomActivity() {
    if (!this.active || this.isDragging) return;
    
    this.stopActivity();
    
    const activity = this.activities[Math.floor(Math.random() * this.activities.length)];
    this.currentActivity = activity;
    
    if (activity === 'walk') {
      this.doggy.className = 'web-doggy walking';
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 3000 + Math.random() * 4000);
    } else if (activity === 'sniff') {
      this.doggy.className = 'web-doggy sniffing';
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 2000);
    } else if (activity === 'dig') {
      this.doggy.className = 'web-doggy digging';
      this.activityTimer = setTimeout(() => {
        this.startRandomActivity();
      }, 2000);
    } else if (activity === 'bark') {
      this.doggy.className = 'web-doggy barking';
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 1000);
    } else if (activity === 'sit') {
      this.doggy.className = 'web-doggy';
      this.doggy.textContent = '🐕';
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 3000);
    }
  }

  stopActivity() {
    clearTimeout(this.activityTimer);
    this.doggy.className = 'web-doggy';
    this.currentActivity = 'idle';
  }

  updatePosition() {
    if (this.doggy) {
      this.doggy.style.left = this.position.x + 'px';
      this.doggy.style.top = this.position.y + 'px';
    }
  }

  callDoggyTo(x, y) {
    this.targetPosition = { x: x - 20, y: y - 40 };
    this.stopActivity();
    this.doggy.className = 'web-doggy running';
  }

  moveToTarget() {
    if (!this.targetPosition) return;
    
    const dx = this.targetPosition.x - this.position.x;
    const dy = this.targetPosition.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) {
      this.targetPosition = null;
      this.startRandomActivity();
      return;
    }
    
    const speed = 5;
    this.position.x += (dx / distance) * speed;
    this.position.y += (dy / distance) * speed;
    
    if ((dx > 0 && !this.isFlipped) || (dx < 0 && this.isFlipped)) {
      this.flip();
    }
    
    this.updatePosition();
  }

  showCommandMenu(x, y) {
    if (this.commandMenu) {
      this.commandMenu.remove();
    }
    
    this.commandMenu = document.createElement('div');
    this.commandMenu.className = 'doggy-command-menu';
    this.commandMenu.style.left = x + 'px';
    this.commandMenu.style.top = y + 'px';
    
    const commands = [
      { text: '🦴 Sit', action: () => this.commandSit() },
      { text: '🏃 Fetch', action: () => this.commandFetch() },
      { text: '🎾 Play', action: () => this.commandPlay() },
      { text: '💤 Sleep', action: () => this.commandSleep() },
      { text: '🦘 Jump', action: () => this.commandJump() }
    ];
    
    commands.forEach(cmd => {
      const btn = document.createElement('button');
      btn.className = 'doggy-command-btn';
      btn.textContent = cmd.text;
      btn.onclick = () => {
        cmd.action();
        this.commandMenu.remove();
        this.commandMenu = null;
      };
      this.commandMenu.appendChild(btn);
    });
    
    document.body.appendChild(this.commandMenu);
    
    setTimeout(() => {
      const closeMenu = (e) => {
        if (this.commandMenu && !this.commandMenu.contains(e.target)) {
          this.commandMenu.remove();
          this.commandMenu = null;
          document.removeEventListener('click', closeMenu);
        }
      };
      document.addEventListener('click', closeMenu);
    }, 100);
  }

  commandSit() {
    this.stopActivity();
    this.doggy.textContent = '🐕';
    this.currentActivity = 'sit';
    setTimeout(() => this.startRandomActivity(), 3000);
  }

  commandFetch() {
    this.stopActivity();
    this.doggy.className = 'web-doggy running';
    const randomX = Math.random() * window.innerWidth;
    const randomY = Math.random() * window.innerHeight + window.scrollY;
    this.callDoggyTo(randomX, randomY);
  }

  commandPlay() {
    this.stopActivity();
    this.doggy.className = 'web-doggy jumping';
    setTimeout(() => {
      this.doggy.className = 'web-doggy barking';
      setTimeout(() => this.startRandomActivity(), 1000);
    }, 600);
  }

  commandSleep() {
    this.stopActivity();
    this.doggy.textContent = '😴';
    this.currentActivity = 'sleep';
    setTimeout(() => {
      this.doggy.textContent = '🐕';
      this.startRandomActivity();
    }, 5000);
  }

  commandJump() {
    this.stopActivity();
    this.doggy.className = 'web-doggy jumping';
    setTimeout(() => this.startRandomActivity(), 600);
  }

  createLadder() {
    const ladder = document.createElement('div');
    ladder.className = 'doggy-ladder';
    ladder.style.left = (this.position.x + 50) + 'px';
    ladder.style.top = (this.position.y - 100) + 'px';
    ladder.style.height = '150px';
    
    let isDragging = false;
    let offsetX, offsetY;
    
    ladder.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - parseInt(ladder.style.left);
      offsetY = e.clientY - parseInt(ladder.style.top);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      ladder.style.left = (e.clientX - offsetX) + 'px';
      ladder.style.top = (e.clientY - offsetY) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    document.body.appendChild(ladder);
    this.ladders.push(ladder);
  }

  createBlock() {
    const block = document.createElement('div');
    block.className = 'doggy-block';
    block.style.left = (this.position.x + 50) + 'px';
    block.style.top = (this.position.y + 20) + 'px';
    block.style.width = '60px';
    block.style.height = '60px';
    block.textContent = '📦';
    
    let isDragging = false;
    let offsetX, offsetY;
    
    block.addEventListener('mousedown', (e) => {
      isDragging = true;
      offsetX = e.clientX - parseInt(block.style.left);
      offsetY = e.clientY - parseInt(block.style.top);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      block.style.left = (e.clientX - offsetX) + 'px';
      block.style.top = (e.clientY - offsetY) + 'px';
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
    
    document.body.appendChild(block);
    this.blocks.push(block);
  }

  stealText(text) {
    this.stopActivity();
    
    const stolenText = document.createElement('div');
    stolenText.className = 'doggy-stolen-text';
    stolenText.textContent = text;
    stolenText.style.left = (this.position.x + 40) + 'px';
    stolenText.style.top = (this.position.y - 20) + 'px';
    
    document.body.appendChild(stolenText);
    this.stolenTexts.push(stolenText);
    
    this.doggy.className = 'web-doggy running';
    this.velocity.x = Math.abs(this.velocity.x) * (this.isFlipped ? -1 : 1) * 2;
    
    const moveText = () => {
      if (!this.active) {
        stolenText.remove();
        return;
      }
      stolenText.style.left = (this.position.x + 40) + 'px';
      stolenText.style.top = (this.position.y - 20) + 'px';
      
      if (this.currentActivity === 'walk' || this.targetPosition) {
        requestAnimationFrame(moveText);
      } else {
        setTimeout(() => {
          stolenText.style.transition = 'opacity 1s';
          stolenText.style.opacity = '0';
          setTimeout(() => {
            stolenText.remove();
            const index = this.stolenTexts.indexOf(stolenText);
            if (index > -1) this.stolenTexts.splice(index, 1);
          }, 1000);
        }, 2000);
      }
    };
    
    moveText();
    
    setTimeout(() => {
      this.velocity.x /= 2;
      this.startRandomActivity();
    }, 3000);
  }
}

// Initialize the doggy
const webDoggy = new WebDoggy();