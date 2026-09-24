const fs = require('fs');

async function run() {
  const lines = fs.readFileSync('map_configs.txt', 'utf8').split('\n');
  let out = {};
  for (let m of lines) {
    m = m.trim();
    if (!m || m.startsWith('//')) continue;
    try {
      const res = await fetch('https://raw.githubusercontent.com/2mlml/cs2-radar-images/master/' + m + '.txt');
      const text = await res.text();
      
      const xMatch = text.match(/"pos_x"\s+"([^"]+)"/);
      const yMatch = text.match(/"pos_y"\s+"([^"]+)"/);
      const scaleMatch = text.match(/"scale"\s+"([^"]+)"/);
      
      if (xMatch && yMatch && scaleMatch) {
        out[m] = {
          scale: parseFloat(scaleMatch[1]),
          x: parseFloat(xMatch[1]),
          y: parseFloat(yMatch[1])
        };
      }
    } catch (e) {
      console.error('Failed on', m, e);
    }
  }
  fs.writeFileSync('extracted_configs.json', JSON.stringify(out, null, 2));
}

run();
