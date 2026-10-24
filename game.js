(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const bestNode = document.getElementById('best-score');
  const restartButton = document.getElementById('restart-button');
  const soundButton = document.getElementById('sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const soundLabel = document.querySelector('.sound-label');

  const W = canvas.width;
  const H = canvas.height;
  const floorY = 634;
  const birdX = 132;
  const birdSize = 48;
  const gravity = 0.27;
  const flapPower = -5.15;
  const pipeWidth = 82;
  const pipeGap = 190;
  const pipeSpacing = 280;
  const worldSpeed = 2.45;
  const images = {};
  const imageFiles = {
    background: 'pinkscape.png',
    birdUp: 'flapup.png',
    birdMid: 'flapmid.png',
    birdDown: 'flapdown.png',
    pipeTop: 'brod.png',
    pipeBottom: 'trod.png'
  };

  function removeWhiteMatte(image) {
    const source = document.createElement('canvas');
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
    const { data } = pixels;
    const width = source.width;
    const height = source.height;
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    const enqueue = index => {
      const offset = index * 4;
      if (data[offset + 3] === 0 || data[offset] < 235 || data[offset + 1] < 235 || data[offset + 2] < 235) return;
      data[offset + 3] = 0;
      queue[tail++] = index;
    };
    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index + width < width * height) enqueue(index + width);
    }
    sourceContext.putImageData(pixels, 0, 0);

    let left = width;
    let top = height;
    let right = 0;
    let bottom = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] === 0) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left || bottom < top) return source;
    const trimmed = document.createElement('canvas');
    trimmed.width = right - left + 1;
    trimmed.height = bottom - top + 1;
    trimmed.getContext('2d').drawImage(source, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
    return trimmed;
  }

  let state = 'ready';
  let birdY = 326;
  let velocity = 0;
  let score = 0;
  let best = Number(localStorage.getItem('birdieflap-best') || 0);
  let pipes = [];
  let tick = 0;
  let groundOffset = 0;
  let soundOn = true;
  let lastFrame = 0;
  let backgroundOffset = 0;
  bestNode.textContent = best;

  Object.entries(imageFiles).forEach(([key, file]) => {
    const image = new Image();
    image.src = `assets/${file}`;
    image.onload = () => {
      images[key] = key === 'background' ? image : removeWhiteMatte(image);
      draw();
    };
  });

  const flapSound = new Audio('assets/cutesound.mp3');
  flapSound.preload = 'auto';
  flapSound.volume = 0.32;

  function playFlap() {
    if (!soundOn) return;
    try {
      flapSound.currentTime = 0;
      const promise = flapSound.play();
      if (promise) promise.catch(() => {});
    } catch (_) { /* Audio is optional. */ }
  }

  function reset() {
    state = 'ready';
    birdY = 326;
    velocity = 0;
    score = 0;
    tick = 0;
    groundOffset = 0;
    backgroundOffset = 0;
    pipes = [];
    addPipe(W + 80);
    addPipe(W + 80 + pipeSpacing);
    draw();
  }

  function addPipe(x) {
    const minCenter = 165;
    const maxCenter = floorY - 165;
    const gapY = minCenter + Math.random() * (maxCenter - minCenter);
    pipes.push({ x, gapY, passed: false });
  }

  function beginOrFlap() {
    if (state === 'over') {
      reset();
      state = 'playing';
    } else if (state === 'paused') {
      state = 'playing';
      return;
    } else if (state === 'ready') {
      state = 'playing';
    }
    velocity = flapPower;
    playFlap();
  }

  function togglePause() {
    if (state === 'playing') state = 'paused';
    else if (state === 'paused') state = 'playing';
    draw();
  }

  function endGame() {
    if (state !== 'playing') return;
    state = 'over';
    if (score > best) {
      best = score;
      localStorage.setItem('birdieflap-best', String(best));
      bestNode.textContent = best;
    }
  }

  function drawBackground() {
    const image = images.background;
    if (image) {
      const scale = H / image.height;
      const drawnWidth = image.width * scale;
      const worldWidth = Math.max(W, drawnWidth);
      const offset = backgroundOffset % worldWidth;
      ctx.drawImage(image, -offset, 0, drawnWidth, H);
      ctx.drawImage(image, worldWidth - offset, 0, drawnWidth, H);
      if (worldWidth < W) ctx.drawImage(image, drawnWidth - offset, 0, drawnWidth, H);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#f9a8ce');
      gradient.addColorStop(1, '#ffe4f0');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawPipes() {
    pipes.forEach(pipe => {
      const gapTop = pipe.gapY - pipeGap / 2;
      const gapBottom = pipe.gapY + pipeGap / 2;
      const topImage = images.pipeTop;
      const bottomImage = images.pipeBottom;
      if (topImage) {
        const scale = pipeWidth / topImage.width;
        const height = topImage.height * scale;
        for (let y = 0; y < gapTop; y += height) {
          ctx.drawImage(topImage, pipe.x, y, pipeWidth, Math.min(height, gapTop - y));
        }
      } else {
        ctx.fillStyle = '#ed78ad';
        ctx.fillRect(pipe.x, 0, pipeWidth, gapTop);
      }
      if (bottomImage) {
        const scale = pipeWidth / bottomImage.width;
        const height = bottomImage.height * scale;
        for (let y = gapBottom; y < floorY; y += height) {
          ctx.drawImage(bottomImage, pipe.x, y, pipeWidth, Math.min(height, floorY - y));
        }
      } else {
        ctx.fillStyle = '#ed78ad';
        ctx.fillRect(pipe.x, gapBottom, pipeWidth, floorY - gapBottom);
      }
    });
  }

  function drawGround() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, floorY, W, H - floorY);
    ctx.clip();
    ctx.fillStyle = '#ee86b4';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = '#fff0f7';
    ctx.fillRect(0, floorY, W, 8);
    ctx.fillStyle = '#d95491';
    ctx.fillRect(0, floorY + 9, W, 4);
    ctx.fillStyle = '#f9acd0';
    const tile = 44;
    const offset = groundOffset % tile;
    for (let x = -tile; x < W + tile; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x - offset, floorY + 15);
      ctx.lineTo(x + 20 - offset, floorY + 15);
      ctx.lineTo(x + 2 - offset, H);
      ctx.lineTo(x - 18 - offset, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBird() {
    const frames = [images.birdUp, images.birdMid, images.birdDown].filter(Boolean);
    const image = frames.length ? frames[Math.floor(tick / 8) % frames.length] : null;
    const angle = state === 'playing' ? Math.max(-0.35, Math.min(0.75, velocity * 0.07)) : Math.sin(tick / 11) * 0.045;
    ctx.save();
    ctx.translate(birdX, birdY);
    ctx.rotate(angle);
    if (image) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, -birdSize / 2, -birdSize / 2, birdSize, birdSize);
    } else {
      ctx.fillStyle = '#ffe83d';
      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawOverlay() {
    if (state === 'playing') return;
    ctx.fillStyle = 'rgba(78, 43, 70, 0.10)';
    ctx.fillRect(0, 0, W, floorY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (state === 'ready') {
      ctx.fillStyle = 'rgba(255, 250, 253, .94)';
      roundedRect(64, 212, 352, 206, 22);
      ctx.fill();
      ctx.fillStyle = '#d9538d';
      ctx.font = '700 34px Fredoka, sans-serif';
      ctx.fillText('Ready, birdie?', W / 2, 264);
      ctx.fillStyle = '#8f7388';
      ctx.font = '500 15px "DM Sans", sans-serif';
      ctx.fillText('Your little adventure starts with one flap.', W / 2, 303);
      ctx.fillStyle = '#eb79a8';
      roundedRect(139, 338, 202, 48, 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 15px "DM Sans", sans-serif';
      ctx.fillText('LET’S FLY  →', W / 2, 362);
    } else if (state === 'paused') {
      ctx.fillStyle = 'rgba(255, 250, 253, .95)';
      roundedRect(104, 270, 272, 132, 22);
      ctx.fill();
      ctx.fillStyle = '#d9538d';
      ctx.font = '700 34px Fredoka, sans-serif';
      ctx.fillText('Taking a breather', W / 2, 320);
      ctx.fillStyle = '#8f7388';
      ctx.font = '500 14px "DM Sans", sans-serif';
      ctx.fillText('Press space or tap to keep going', W / 2, 359);
    } else {
      ctx.fillStyle = 'rgba(255, 250, 253, .96)';
      roundedRect(88, 222, 304, 244, 22);
      ctx.fill();
      ctx.fillStyle = '#d9538d';
      ctx.font = '700 37px Fredoka, sans-serif';
      ctx.fillText('A lovely try!', W / 2, 269);
      ctx.fillStyle = '#927a8d';
      ctx.font = '500 14px "DM Sans", sans-serif';
      ctx.fillText('The sky will be here when you’re ready.', W / 2, 302);
      ctx.fillStyle = '#f9eaf1';
      roundedRect(148, 329, 184, 71, 14);
      ctx.fill();
      ctx.fillStyle = '#aa8d9f';
      ctx.font = '500 10px "DM Mono", monospace';
      ctx.fillText('SCORE', W / 2, 347);
      ctx.fillStyle = '#d9538d';
      ctx.font = '700 29px Fredoka, sans-serif';
      ctx.fillText(String(score), W / 2, 378);
      ctx.fillStyle = '#df6398';
      ctx.font = '600 12px "DM Sans", sans-serif';
      ctx.fillText('TAP TO TRY AGAIN', W / 2, 434);
    }
  }

  function drawScore() {
    if (state === 'ready') return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '700 48px Fredoka, sans-serif';
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(186, 83, 133, .45)';
    ctx.strokeText(String(score), W / 2, 39);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(score), W / 2, 39);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawPipes();
    drawGround();
    drawBird();
    drawScore();
    drawOverlay();
  }

  function update(delta) {
    tick += delta / 16.67;
    if (state === 'ready') {
      birdY = 326 + Math.sin(tick / 8) * 7;
      return;
    }
    if (state !== 'playing') return;
    velocity += gravity * (delta / 16.67);
    birdY += velocity * (delta / 16.67);
    groundOffset += worldSpeed * (delta / 16.67);
    backgroundOffset += 0.35 * (delta / 16.67);
    pipes.forEach(pipe => {
      pipe.x -= worldSpeed * (delta / 16.67);
      if (!pipe.passed && pipe.x + pipeWidth < birdX) {
        pipe.passed = true;
        score += 1;
      }
    });
    while (pipes.length && pipes[0].x + pipeWidth < -8) pipes.shift();
    if (pipes.length < 3) addPipe(pipes[pipes.length - 1].x + pipeSpacing);
    const birdRadius = 19;
    if (birdY - birdRadius < 0 || birdY + birdRadius > floorY) endGame();
    const hitboxX = birdX - birdRadius + 7;
    const hitboxRight = birdX + birdRadius - 6;
    pipes.forEach(pipe => {
      const gapTop = pipe.gapY - pipeGap / 2;
      const gapBottom = pipe.gapY + pipeGap / 2;
      const overlapsX = hitboxRight > pipe.x + 5 && hitboxX < pipe.x + pipeWidth - 4;
      if (overlapsX && (birdY - birdRadius + 5 < gapTop || birdY + birdRadius - 5 > gapBottom)) endGame();
    });
  }

  function loop(now) {
    const delta = Math.min(now - (lastFrame || now), 40);
    lastFrame = now;
    update(delta);
    draw();
    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    beginOrFlap();
  });
  window.addEventListener('keydown', event => {
    if (event.code === 'Space' || event.code === 'ArrowUp') {
      event.preventDefault();
      if (!event.repeat) beginOrFlap();
    } else if (event.code === 'Escape' || event.code === 'KeyP') {
      togglePause();
    }
  });
  restartButton.addEventListener('click', () => reset());
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundIcon.textContent = soundOn ? '♫' : '♪';
    soundLabel.textContent = soundOn ? 'SOUND ON' : 'SOUND OFF';
    soundButton.setAttribute('aria-label', soundOn ? 'Turn sound off' : 'Turn sound on');
  });

  reset();
  requestAnimationFrame(loop);
})();
