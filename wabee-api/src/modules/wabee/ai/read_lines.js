
const fs = require('fs');
const file = "c:\\Users\\raul\\Desktop\\Estadia 11\\PROYECTO WABEE\\WABEE_V7\\core-starter\\apps\\api\\src\\modules\\wabee\\ai\\ai.orchestrator.service.ts";
const lines = fs.readFileSync(file, 'utf8').split('\n');
for (let i = 880; i < 910; i++) {
    if (lines[i]) {
        console.log(`${i + 1}: ${lines[i].replace(/\r/g, '')}`);
    }
}
