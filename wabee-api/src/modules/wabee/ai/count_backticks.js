
const fs = require('fs');
const file = "c:\\Users\\raul\\Desktop\\Estadia 11\\PROYECTO\\ WABEE\\WABEE_V7\\core-starter\\apps\\api\\src\\modules\\wabee\\ai\\ai.orchestrator.service.ts";
const content = fs.readFileSync(file, 'utf8');
const backticks = content.split('`').length - 1;
console.log('Total Backticks:', backticks);
if (backticks % 2 !== 0) {
    const lines = content.split('\n');
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('`')) {
            count += (lines[i].split('`').length - 1);
            console.log(`Line ${i + 1}: ${count} total so far`);
        }
    }
}
