
import fs from 'fs'

const data = JSON.parse(fs.readFileSync('dragnet-polygons.json', 'utf8'))

console.log('Total Zones in JSON:', data.length)

const sample = data.slice(0, 20).map(z => ({ zoneCode: z.zoneCode, zoneName: z.zoneName }))
console.log('Samples:', JSON.stringify(sample, null, 2))

const areaCounts = {}
data.forEach(z => {
  const area = z.zoneCode.split(' ')[0]
  areaCounts[area] = (areaCounts[area] || 0) + 1
})

console.log('Area counts from zoneCode:', JSON.stringify(areaCounts, null, 2))
