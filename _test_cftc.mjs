// Test 3 — Get all field names and values for Gold COMEX
const base = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json';
const where = `contract_market_name = 'GOLD - COMMODITY EXCHANGE INC.' AND report_date_as_yyyy_mm_dd > '2026-02-01'`;
const url = `${base}?$where=${encodeURIComponent(where)}&$limit=1&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd DESC')}`;
const r = await fetch(url);
const data = await r.json();
if (data[0]) {
    for (const [k, v] of Object.entries(data[0])) {
        console.log(`${k}: ${v}`);
    }
} else {
    console.log('No data for GOLD - COMMODITY EXCHANGE INC.');
    // Try just 'GOLD'
    const where2 = `contract_market_name = 'GOLD' AND report_date_as_yyyy_mm_dd > '2026-02-01'`;
    const url2 = `${base}?$where=${encodeURIComponent(where2)}&$limit=1&$order=${encodeURIComponent('report_date_as_yyyy_mm_dd DESC')}`;
    const r2 = await fetch(url2);
    const d2 = await r2.json();
    console.log('\nTrying just GOLD:');
    if (d2[0]) {
        for (const [k, v] of Object.entries(d2[0])) {
            console.log(`${k}: ${v}`);
        }
    } else {
        console.log('No data');
    }
}
