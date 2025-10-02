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
    this.mouthText = null;
    this.mouthElement = null;
    this.placementMode = false;
    this.placementListener = null;
    this.gravity = 0.5;
    this.jumpForce = -10;
    this.lastScrollY = window.scrollY;
    this.stuckCounter = 0;
    this.lastPosition = { x: 0, y: 0 };
    this.stuckThreshold = 50;
    this.isFlying = false;
    this.flyingTarget = null;
    
    this.activities = ['walk', 'sniff', 'dig', 'bark', 'sit'];
    this.setupMessageListener();
    this.setupClickListener();
    this.setupKeyboardListener();
    this.setupScrollListener();
  }

  setupScrollListener() {
    window.addEventListener('scroll', () => {
      if (!this.active || this.isDragging) return;
      
      const scrollDelta = window.scrollY - this.lastScrollY;
      this.position.y += scrollDelta;
      this.lastScrollY = window.scrollY;
      
      this.updatePosition();
    });
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
      } else if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        this.stealTypedText();
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        this.preparePlacement();
      } else if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.toggleFlyMode();
      } else if (e.ctrlKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.jumpToElement('up');
      } else if (e.ctrlKey && e.key === 'ArrowDown') {
        e.preventDefault();
        this.jumpToElement('down');
      } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.jumpToElement('left');
      } else if (e.ctrlKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.jumpToElement('right');
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
    this.lastScrollY = window.scrollY; // Initialize scroll position
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
    this.isFlying = false;
    this.flyingTarget = null;
    cancelAnimationFrame(this.animationFrame);
    clearTimeout(this.activityTimer);
    
    if (this.flyingControlHandler) {
      document.removeEventListener('keydown', this.flyingControlHandler);
      this.flyingControlHandler = null;
    }
    
    if (this.doggy) {
      this.doggy.remove();
      this.doggy = null;
    }
    
    if (this.commandMenu) {
      this.commandMenu.remove();
      this.commandMenu = null;
    }
    
    if (this.mouthElement) {
      this.mouthElement.remove();
      this.mouthElement = null;
    }
    
    if (this.placementListener) {
      document.removeEventListener('click', this.placementListener);
      this.placementListener = null;
    }
    
    this.ladders.forEach(l => l.remove());
    this.blocks.forEach(b => b.remove());
    this.stolenTexts.forEach(t => t.remove());
    this.ladders = [];
    this.blocks = [];
    this.stolenTexts = [];
    this.mouthText = null;
    this.placementMode = false;
  }

  setupDragAndDrop() {
    let offsetX, offsetY;
    
    this.doggy.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.doggy.classList.add('dragging');
      offsetX = e.clientX - this.position.x;
      offsetY = e.clientY - this.position.y;
      this.stopActivity();
      this.velocity.y = 0; // Stop falling when grabbed
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
        this.velocity.y = 0; // Reset velocity when released
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
    
    // Check if doggy is stuck
    this.checkIfStuck();
    
    if (this.isFlying) {
      this.fly();
    } else if (this.currentActivity === 'walk' && !this.isDragging) {
      this.walk();
    } else if (this.targetPosition && !this.isDragging) {
      this.moveToTarget();
    }
    
    this.animationFrame = requestAnimationFrame(() => this.updateLoop());
  }

  checkIfStuck() {
    const moved = Math.abs(this.position.x - this.lastPosition.x) + 
                  Math.abs(this.position.y - this.lastPosition.y);
    
    if (moved < 1 && this.currentActivity === 'walk') {
      this.stuckCounter++;
      
      if (this.stuckCounter > this.stuckThreshold) {
        // Doggy is stuck, try to unstuck
        this.unstuck();
        this.stuckCounter = 0;
      }
    } else {
      this.stuckCounter = 0;
    }
    
    this.lastPosition.x = this.position.x;
    this.lastPosition.y = this.position.y;
  }

  unstuck() {
    // Try jumping
    this.velocity.y = this.jumpForce;
    this.doggy.className = 'web-doggy jumping';
    
    // Also change direction
    this.velocity.x *= -1;
    this.flip();
    
    setTimeout(() => {
      if (this.currentActivity === 'walk') {
        this.doggy.className = 'web-doggy walking';
      }
    }, 600);
  }

  walk() {
    this.position.x += this.velocity.x;
    
    // Apply gravity
    if (!this.isClimbing) {
      this.velocity.y += 0.5; // Gravity
    }
    
    this.position.y += this.velocity.y;
    
    // Get surface info below doggy
    const surfaceInfo = this.getSurfaceBelow();
    
    if (surfaceInfo) {
      // Land on the surface
      if (this.position.y + 35 >= surfaceInfo.top) {
        this.position.y = surfaceInfo.top - 35;
        this.velocity.y = 0;
        this.isClimbing = false;
      }
    } else {
      // No surface found, limit falling
      const maxFallDepth = window.innerHeight + window.scrollY;
      if (this.position.y > maxFallDepth - 100) {
        // Create an invisible floor
        this.position.y = maxFallDepth - 100;
        this.velocity.y = 0;
      }
    }
    
    // Check for ladder climbing
    const ladder = this.checkLadderCollision();
    if (ladder && Math.random() < 0.02) {
      this.isClimbing = true;
      this.velocity.y = -2;
    }
    
    // Screen boundaries with padding
    const edgePadding = 10;
    if (this.position.x > window.innerWidth - 50 - edgePadding) {
      this.position.x = window.innerWidth - 50 - edgePadding;
      this.velocity.x *= -1;
      this.flip();
    } else if (this.position.x < edgePadding) {
      this.position.x = edgePadding;
      this.velocity.x *= -1;
      this.flip();
    }
    
    // Bottom boundary
    if (this.position.y > window.innerHeight + window.scrollY - 50) {
      this.position.y = window.innerHeight + window.scrollY - 50;
      this.velocity.y = 0;
    }
    
    this.updatePosition();
  }

  getSurfaceBelow() {
    const checkPoints = [
      { x: this.position.x + 10, y: this.position.y + 36 },
      { x: this.position.x + 25, y: this.position.y + 36 }
    ];
    
    let closestSurface = null;
    let closestDistance = Infinity;
    
    for (let point of checkPoints) {
      // Check custom objects first (blocks and ladders)
      for (let block of this.blocks) {
        const rect = block.getBoundingClientRect();
        const blockTop = rect.top + window.scrollY;
        const blockBottom = rect.bottom + window.scrollY;
        const blockLeft = rect.left + window.scrollX;
        const blockRight = rect.right + window.scrollX;
        
        if (point.x >= blockLeft && point.x <= blockRight &&
            point.y >= blockTop - 5 && point.y <= blockBottom) {
          const distance = Math.abs(point.y - blockTop);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestSurface = { top: blockTop, element: block };
          }
        }
      }
      
      // Check DOM elements
      const elements = document.elementsFromPoint(
        point.x - window.scrollX,
        point.y - window.scrollY
      );
      
      for (let el of elements) {
        if (el === this.doggy || 
            el.classList.contains('doggy-stolen-text') ||
            el.classList.contains('doggy-command-menu') ||
            el === this.mouthElement) {
          continue;
        }
        
        // Check if element is visible and has dimensions
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        
        // Skip if element is the body or html
        if (el === document.body || el === document.documentElement) continue;
        
        const computedStyle = window.getComputedStyle(el);
        
        // Check if element can be walked on
        const canWalkOn = (
          el.tagName === 'IMG' ||
          el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'BUTTON' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'LABEL' ||
          el.tagName === 'A' ||
          el.classList.contains('doggy-block') ||
          rect.height > 20 || // Substantial elements
          parseFloat(computedStyle.borderTopWidth) > 0 || // Elements with borders
          computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' || // Elements with background
          computedStyle.backgroundImage !== 'none'
        );
        
        if (canWalkOn) {
          const elementTop = rect.top + window.scrollY;
          const distance = Math.abs(point.y - elementTop);
          
          if (distance < closestDistance && distance < 100) {
            closestDistance = distance;
            closestSurface = { top: elementTop, element: el };
          }
        }
      }
    }
    
    return closestSurface;
  }

  checkLadderCollision() {
    for (let ladder of this.ladders) {
      const rect = ladder.getBoundingClientRect();
      const ladderLeft = rect.left + window.scrollX;
      const ladderRight = rect.right + window.scrollX;
      const ladderTop = rect.top + window.scrollY;
      const ladderBottom = rect.bottom + window.scrollY;
      
      if (this.position.x + 20 >= ladderLeft && 
          this.position.x + 20 <= ladderRight &&
          this.position.y + 35 >= ladderTop && 
          this.position.y <= ladderBottom) {
        return ladder;
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
      this.velocity.y = 0; // Reset vertical velocity when starting to walk
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 3000 + Math.random() * 4000);
    } else if (activity === 'sniff') {
      this.doggy.className = 'web-doggy sniffing';
      this.velocity.x = 0; // Stop horizontal movement
      this.velocity.y = 0;
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 2000);
    } else if (activity === 'dig') {
      this.doggy.className = 'web-doggy digging';
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.activityTimer = setTimeout(() => {
        this.startRandomActivity();
      }, 2000);
    } else if (activity === 'bark') {
      this.doggy.className = 'web-doggy barking';
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 1000);
    } else if (activity === 'sit') {
      this.doggy.className = 'web-doggy';
      this.doggy.textContent = '🐕';
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.activityTimer = setTimeout(() => this.startRandomActivity(), 3000);
    }
  }

  stopActivity() {
    clearTimeout(this.activityTimer);
    this.doggy.className = 'web-doggy';
    this.currentActivity = 'idle';
    this.velocity.x = Math.abs(this.velocity.x) > 0 ? this.velocity.x : 2;
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
      this.velocity.y = 0;
      this.isFlying = false;
      this.flyingTarget = null;
      this.doggy.textContent = '🐕';
      this.startRandomActivity();
      return;
    }
    
    // Check if target is significantly above or below (needs flying)
    const verticalDistance = Math.abs(dy);
    const horizontalDistance = Math.abs(dx);
    
    if (verticalDistance > 150 && !this.isFlying) {
      // Start flying mode
      this.startFlying(this.targetPosition);
      return;
    }
    
    const speed = 5;
    const moveX = (dx / distance) * speed;
    
    this.position.x += moveX;
    
    // Apply gravity and surface detection even when moving to target
    const surfaceInfo = this.getSurfaceBelow();
    
    if (surfaceInfo && this.position.y + 35 >= surfaceInfo.top - 5) {
      // Walking on surface
      this.position.y = surfaceInfo.top - 35;
      this.velocity.y = 0;
      
      // Jump over obstacles if target is above or far
      if (this.targetPosition.y < this.position.y - 30 || Math.abs(dx) > 100) {
        this.velocity.y = -10;
        this.doggy.className = 'web-doggy jumping';
      }
    } else {
      // In air - apply gravity
      this.velocity.y += 0.5;
      this.position.y += this.velocity.y;
      
      // If we need to go up, jump
      if (dy < -50 && this.velocity.y > -5) {
        this.velocity.y = -10;
      }
    }
    
    // Check ladder
    const ladder = this.checkLadderCollision();
    if (ladder && this.targetPosition.y < this.position.y) {
      this.velocity.y = -3;
      this.isClimbing = true;
    }
    
    if ((dx > 0 && !this.isFlipped) || (dx < 0 && this.isFlipped)) {
      this.flip();
    }
    
    this.updatePosition();
  }

  startFlying(target) {
    this.isFlying = true;
    this.flyingTarget = target;
    this.doggy.textContent = '🐕';
    this.doggy.className = 'web-doggy flying';
    this.stopActivity();
    
    // Add flying animation to CSS dynamically
    if (!document.getElementById('doggy-fly-style')) {
      const style = document.createElement('style');
      style.id = 'doggy-fly-style';
      style.textContent = `
        @keyframes fly {
          0%, 100% { transform: translateY(0) rotate(-5deg); }
          50% { transform: translateY(-8px) rotate(5deg); }
        }
        .web-doggy.flying {
          animation: fly 0.3s infinite;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Show flying indicator
    const indicator = document.createElement('div');
    indicator.textContent = '✈️';
    indicator.style.position = 'absolute';
    indicator.style.left = (this.position.x + 40) + 'px';
    indicator.style.top = (this.position.y - 20) + 'px';
    indicator.style.fontSize = '20px';
    indicator.style.zIndex = '1000000';
    indicator.style.pointerEvents = 'none';
    document.body.appendChild(indicator);
    
    const updateIndicator = () => {
      if (this.isFlying && this.active) {
        indicator.style.left = (this.position.x + 40) + 'px';
        indicator.style.top = (this.position.y - 20) + 'px';
        requestAnimationFrame(updateIndicator);
      } else {
        indicator.style.transition = 'opacity 0.5s';
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 500);
      }
    };
    updateIndicator();
  }

  fly() {
    if (!this.flyingTarget) {
      this.isFlying = false;
      this.doggy.className = 'web-doggy';
      return;
    }
    
    const dx = this.flyingTarget.x - this.position.x;
    const dy = this.flyingTarget.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 15) {
      // Reached target
      this.isFlying = false;
      this.flyingTarget = null;
      this.velocity.y = 0;
      this.doggy.className = 'web-doggy';
      this.doggy.textContent = '🐕';
      this.targetPosition = null;
      this.startRandomActivity();
      return;
    }
    
    const flySpeed = 6;
    this.position.x += (dx / distance) * flySpeed;
    this.position.y += (dy / distance) * flySpeed;
    
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
      { text: '🦘 Jump', action: () => this.commandJump() },
      { text: this.isFlying ? '🛬 Land' : '✈️ Fly', action: () => this.toggleFlyMode() }
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
    this.velocity.y = this.jumpForce;
    this.doggy.className = 'web-doggy jumping';
    setTimeout(() => this.startRandomActivity(), 600);
  }

  toggleFlyMode() {
    if (this.isFlying) {
      // Stop flying
      this.isFlying = false;
      this.flyingTarget = null;
      this.doggy.className = 'web-doggy';
      this.doggy.textContent = '🐕';
      this.startRandomActivity();
      
      // Show message
      const msg = document.createElement('div');
      msg.className = 'doggy-stolen-text';
      msg.textContent = '🐕 Landing...';
      msg.style.left = (this.position.x + 40) + 'px';
      msg.style.top = (this.position.y - 40) + 'px';
      msg.style.background = 'rgba(100, 200, 255, 0.9)';
      document.body.appendChild(msg);
      
      setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
      }, 1000);
    } else {
      // Start free flying mode
      this.isFlying = true;
      this.flyingTarget = null; // Free flight, no target
      this.stopActivity();
      this.doggy.textContent = '🐕';
      this.doggy.className = 'web-doggy flying';
      
      // Add flying animation if not already added
      if (!document.getElementById('doggy-fly-style')) {
        const style = document.createElement('style');
        style.id = 'doggy-fly-style';
        style.textContent = `
          @keyframes fly {
            0%, 100% { transform: translateY(0) rotate(-5deg); }
            50% { transform: translateY(-8px) rotate(5deg); }
          }
          .web-doggy.flying {
            animation: fly 0.3s infinite;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Show message
      const msg = document.createElement('div');
      msg.className = 'doggy-stolen-text';
      msg.textContent = '✈️ Flying! Use arrows to move';
      msg.style.left = (this.position.x + 40) + 'px';
      msg.style.top = (this.position.y - 40) + 'px';
      msg.style.background = 'rgba(100, 200, 255, 0.9)';
      msg.style.maxWidth = '250px';
      document.body.appendChild(msg);
      
      setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
      }, 2500);
      
      // Setup flying controls
      this.setupFlyingControls();
    }
  }

  setupFlyingControls() {
    const flyingControlHandler = (e) => {
      if (!this.isFlying || this.flyingTarget) return;
      
      const flySpeed = 8;
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.position.y -= flySpeed;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.position.y += flySpeed;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.position.x -= flySpeed;
        if (!this.isFlipped) this.flip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.position.x += flySpeed;
        if (this.isFlipped) this.flip();
      }
      
      this.updatePosition();
    };
    
    // Remove old listener if exists
    if (this.flyingControlHandler) {
      document.removeEventListener('keydown', this.flyingControlHandler);
    }
    
    this.flyingControlHandler = flyingControlHandler;
    document.addEventListener('keydown', flyingControlHandler);
  }

  jumpToElement(direction) {
    this.stopActivity();
    
    const currentRect = {
      x: this.position.x,
      y: this.position.y,
      width: 40,
      height: 35
    };
    
    // Find all walkable elements
    const walkableElements = this.findWalkableElements();
    let targetElement = null;
    let minDistance = Infinity;
    
    for (let el of walkableElements) {
      const rect = el.getBoundingClientRect();
      const elX = rect.left + window.scrollX + rect.width / 2;
      const elY = rect.top + window.scrollY;
      
      let isValid = false;
      let distance = 0;
      
      if (direction === 'up') {
        isValid = elY < currentRect.y - 50;
        distance = currentRect.y - elY;
      } else if (direction === 'down') {
        isValid = elY > currentRect.y + 50;
        distance = elY - currentRect.y;
      } else if (direction === 'left') {
        isValid = elX < currentRect.x - 50;
        distance = currentRect.x - elX;
      } else if (direction === 'right') {
        isValid = elX > currentRect.x + 50;
        distance = elX - currentRect.x;
      }
      
      if (isValid && distance < minDistance) {
        minDistance = distance;
        targetElement = { x: elX, y: elY };
      }
    }
    
    if (targetElement) {
      // Jump animation
      this.doggy.className = 'web-doggy jumping';
      
      // Move to target with animation
      this.callDoggyTo(targetElement.x, targetElement.y - 10);
      
      // Show jump indicator
      const indicator = document.createElement('div');
      indicator.textContent = direction === 'up' ? '⬆️' : 
                            direction === 'down' ? '⬇️' : 
                            direction === 'left' ? '⬅️' : '➡️';
      indicator.style.position = 'absolute';
      indicator.style.left = (this.position.x + 15) + 'px';
      indicator.style.top = (this.position.y - 30) + 'px';
      indicator.style.fontSize = '24px';
      indicator.style.zIndex = '1000000';
      indicator.style.pointerEvents = 'none';
      document.body.appendChild(indicator);
      
      setTimeout(() => {
        indicator.style.transition = 'opacity 0.5s';
        indicator.style.opacity = '0';
        setTimeout(() => indicator.remove(), 500);
      }, 500);
    } else {
      // No element found, show message
      const msg = document.createElement('div');
      msg.className = 'doggy-stolen-text';
      msg.textContent = '🐕 No element found!';
      msg.style.left = (this.position.x + 40) + 'px';
      msg.style.top = (this.position.y - 40) + 'px';
      msg.style.background = 'rgba(255, 200, 100, 0.9)';
      document.body.appendChild(msg);
      
      setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
      }, 1500);
      
      this.startRandomActivity();
    }
  }

  findWalkableElements() {
    const elements = [];
    const allElements = document.querySelectorAll('*');
    
    for (let el of allElements) {
      if (el === this.doggy || 
          el.classList.contains('doggy-stolen-text') ||
          el.classList.contains('doggy-command-menu') ||
          el === this.mouthElement ||
          el === document.body ||
          el === document.documentElement) {
        continue;
      }
      
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      
      const computedStyle = window.getComputedStyle(el);
      
      const canWalkOn = (
        el.tagName === 'IMG' ||
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'BUTTON' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'LABEL' ||
        el.tagName === 'A' ||
        el.tagName === 'H1' ||
        el.tagName === 'H2' ||
        el.tagName === 'H3' ||
        el.tagName === 'H4' ||
        el.tagName === 'H5' ||
        el.tagName === 'H6' ||
        el.tagName === 'P' ||
        el.tagName === 'DIV' && rect.height > 30 ||
        el.tagName === 'SPAN' && rect.height > 20 ||
        el.classList.contains('doggy-block') ||
        parseFloat(computedStyle.borderTopWidth) > 0 ||
        computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        computedStyle.backgroundImage !== 'none'
      );
      
      if (canWalkOn) {
        elements.push(el);
      }
    }
    
    // Also add custom blocks
    for (let block of this.blocks) {
      elements.push(block);
    }
    
    return elements;
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

  stealTypedText() {
    const activeElement = document.activeElement;
    
    if (activeElement && (activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable)) {
      
      let text = '';
      if (activeElement.isContentEditable) {
        text = activeElement.innerText;
      } else {
        text = activeElement.value;
      }
      
      if (text && text.trim().length > 0) {
        // Get position of the input element
        const rect = activeElement.getBoundingClientRect();
        const targetX = rect.left + window.scrollX + rect.width / 2;
        const targetY = rect.top + window.scrollY;
        
        // Make doggy run to the input element first
        this.stopActivity();
        this.doggy.className = 'web-doggy running';
        this.callDoggyTo(targetX, targetY);
        
        // Wait for doggy to arrive, then grab text
        const checkArrival = setInterval(() => {
          const distance = Math.sqrt(
            Math.pow(this.position.x - targetX, 2) + 
            Math.pow(this.position.y - targetY, 2)
          );
          
          if (distance < 80) {
            clearInterval(checkArrival);
            
            // Dig animation to get the text
            this.doggy.className = 'web-doggy digging';
            
            setTimeout(() => {
              // Now grab the text
              this.mouthText = text;
              
              // Clear the input
              if (activeElement.isContentEditable) {
                activeElement.innerText = '';
              } else {
                activeElement.value = '';
              }
              
              // Flash the element
              const originalBorder = activeElement.style.border;
              activeElement.style.border = '3px solid #ff6b6b';
              setTimeout(() => {
                activeElement.style.border = originalBorder;
              }, 500);
              
              // Create visual indicator
              this.createMouthElement(text);
              
              // Make doggy run away
              this.doggy.className = 'web-doggy running';
              const randomX = Math.random() * (window.innerWidth - 100) + 50;
              this.callDoggyTo(randomX, this.position.y);
              
              setTimeout(() => {
                this.startRandomActivity();
              }, 2000);
            }, 1000);
          }
        }, 100);
      }
    }
  }

  createMouthElement(text) {
    if (this.mouthElement) {
      this.mouthElement.remove();
    }
    
    this.mouthElement = document.createElement('div');
    this.mouthElement.className = 'doggy-stolen-text';
    this.mouthElement.textContent = '💬 ' + text.substring(0, 30) + (text.length > 30 ? '...' : '');
    this.mouthElement.style.left = (this.position.x + 40) + 'px';
    this.mouthElement.style.top = (this.position.y - 20) + 'px';
    this.mouthElement.style.background = 'rgba(255, 215, 0, 0.9)';
    this.mouthElement.style.border = '2px solid #FFD700';
    
    document.body.appendChild(this.mouthElement);
    
    // Update position with doggy
    const updateMouthPosition = () => {
      if (!this.active || !this.mouthElement) return;
      this.mouthElement.style.left = (this.position.x + 40) + 'px';
      this.mouthElement.style.top = (this.position.y - 20) + 'px';
      requestAnimationFrame(updateMouthPosition);
    };
    updateMouthPosition();
  }

  preparePlacement() {
    if (!this.mouthText) {
      // Show message that mouth is empty
      const msg = document.createElement('div');
      msg.className = 'doggy-stolen-text';
      msg.textContent = '🐕 Nothing in mouth!';
      msg.style.left = (this.position.x + 40) + 'px';
      msg.style.top = (this.position.y - 40) + 'px';
      msg.style.background = 'rgba(255, 100, 100, 0.9)';
      document.body.appendChild(msg);
      
      setTimeout(() => {
        msg.style.transition = 'opacity 0.5s';
        msg.style.opacity = '0';
        setTimeout(() => msg.remove(), 500);
      }, 1500);
      return;
    }
    
    this.placementMode = true;
    document.body.style.cursor = 'crosshair';
    
    // Show placement indicator
    const indicator = document.createElement('div');
    indicator.className = 'doggy-stolen-text';
    indicator.textContent = '📍 Click to place text';
    indicator.style.left = (this.position.x + 40) + 'px';
    indicator.style.top = (this.position.y - 40) + 'px';
    indicator.style.background = 'rgba(100, 200, 255, 0.9)';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
      indicator.style.transition = 'opacity 0.5s';
      indicator.style.opacity = '0';
      setTimeout(() => indicator.remove(), 500);
    }, 2000);
    
    // Remove old listener if exists
    if (this.placementListener) {
      document.removeEventListener('click', this.placementListener);
    }
    
    this.placementListener = (e) => {
      if (e.target.classList.contains('web-doggy') || 
          e.target.classList.contains('doggy-stolen-text')) {
        return;
      }
      
      this.placeText(e.pageX, e.pageY);
      document.body.style.cursor = 'default';
      this.placementMode = false;
      document.removeEventListener('click', this.placementListener);
      this.placementListener = null;
    };
    
    document.addEventListener('click', this.placementListener);
  }

  placeText(x, y) {
    if (!this.mouthText) return;
    
    // Check what element is at the click position
    const elements = document.elementsFromPoint(x - window.scrollX, y - window.scrollY);
    let targetElement = null;
    
    // Find the first input/textarea/editable element
    for (let el of elements) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
        targetElement = el;
        break;
      }
    }
    
    // Run to placement location
    this.stopActivity();
    this.callDoggyTo(x, y);
    
    // Wait for doggy to arrive, then place text
    const checkArrival = setInterval(() => {
      const distance = Math.sqrt(
        Math.pow(this.position.x - x, 2) + 
        Math.pow(this.position.y - y, 2)
      );
      
      if (distance < 50) {
        clearInterval(checkArrival);
        
        if (targetElement) {
          // Fill the input element
          if (targetElement.isContentEditable) {
            targetElement.innerText = this.mouthText;
          } else {
            targetElement.value = this.mouthText;
          }
          
          // Highlight the element briefly
          const originalBorder = targetElement.style.border;
          targetElement.style.border = '3px solid #667eea';
          targetElement.style.transition = 'border 0.3s';
          
          setTimeout(() => {
            targetElement.style.border = originalBorder;
          }, 1000);
        } else {
          // Place the text as a sticky note on the page
          const textElement = document.createElement('div');
          textElement.style.position = 'absolute';
          textElement.style.left = x + 'px';
          textElement.style.top = y + 'px';
          textElement.style.background = 'rgba(255, 255, 255, 0.95)';
          textElement.style.padding = '10px 15px';
          textElement.style.borderRadius = '8px';
          textElement.style.border = '2px solid #667eea';
          textElement.style.zIndex = '999996';
          textElement.style.maxWidth = '300px';
          textElement.style.wordWrap = 'break-word';
          textElement.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          textElement.style.fontFamily = 'Arial, sans-serif';
          textElement.style.fontSize = '14px';
          textElement.textContent = this.mouthText;
          
          // Make it draggable
          let isDragging = false;
          let offsetX, offsetY;
          
          textElement.style.cursor = 'move';
          
          textElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - parseInt(textElement.style.left);
            offsetY = e.clientY - parseInt(textElement.style.top);
            textElement.style.zIndex = '999999';
          });
          
          document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            textElement.style.left = (e.clientX - offsetX) + 'px';
            textElement.style.top = (e.clientY - offsetY) + 'px';
          });
          
          document.addEventListener('mouseup', () => {
            if (isDragging) {
              isDragging = false;
              textElement.style.zIndex = '999996';
            }
          });
          
          // Add delete button
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = '×';
          deleteBtn.style.position = 'absolute';
          deleteBtn.style.top = '-10px';
          deleteBtn.style.right = '-10px';
          deleteBtn.style.width = '24px';
          deleteBtn.style.height = '24px';
          deleteBtn.style.borderRadius = '50%';
          deleteBtn.style.border = 'none';
          deleteBtn.style.background = '#f5576c';
          deleteBtn.style.color = 'white';
          deleteBtn.style.cursor = 'pointer';
          deleteBtn.style.fontSize = '18px';
          deleteBtn.style.lineHeight = '1';
          deleteBtn.onclick = () => textElement.remove();
          textElement.appendChild(deleteBtn);
          
          document.body.appendChild(textElement);
        }
        
        // Clear mouth
        this.mouthText = null;
        if (this.mouthElement) {
          this.mouthElement.remove();
          this.mouthElement = null;
        }
        
        // Doggy celebrates
        this.doggy.className = 'web-doggy jumping';
        setTimeout(() => {
          this.doggy.className = 'web-doggy barking';
          setTimeout(() => this.startRandomActivity(), 1000);
        }, 600);
      }
    }, 100);
  }
}

// Initialize the doggy
const webDoggy = new WebDoggy();