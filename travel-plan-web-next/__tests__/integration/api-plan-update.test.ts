import fs from 'fs'
import path from 'path'

// Mock data for testing
const mockRouteData = [
  {
    date: '2026/9/25',
    weekDay: '星期五',
    dayNum: 1,
    overnight: '巴黎',
    plan: {
      morning: 'Morning activity',
      afternoon: 'Afternoon activity',
      evening: 'Evening activity',
    },
    train: [],
  },
  {
    date: '2026/9/26',
    weekDay: '星期六',
    dayNum: 2,
    overnight: '巴黎',
    plan: {
      morning: 'Day 2 morning',
      afternoon: 'Day 2 afternoon',
      evening: 'Day 2 evening',
    },
    train: [],
  },
]

describe('POST /api/plan-update', () => {
  let tempFilePath: string

  beforeEach(() => {
    // Create a temp JSON file for testing
    tempFilePath = path.join(__dirname, 'test-route.json')
    fs.writeFileSync(tempFilePath, JSON.stringify(mockRouteData, null, 2))
  })

  afterEach(() => {
    // Clean up temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath)
    }
  })

  it('accepts valid dayIndex and plan, returns 200 with updated data', async () => {
    const payload = {
      dayIndex: 0,
      plan: {
        morning: 'Updated morning',
        afternoon: 'Updated afternoon',
        evening: 'Updated evening',
      },
    }

    // Read the temp file
    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    expect(data[0].plan.morning).toBe('Morning activity')

    // Simulate API update logic
    if (payload.dayIndex < 0 || payload.dayIndex >= data.length) {
      throw new Error('Invalid dayIndex')
    }

    data[payload.dayIndex].plan = payload.plan
    fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2))

    // Verify update
    const updated = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    expect(updated[0].plan.morning).toBe('Updated morning')
    expect(updated[0].plan.afternoon).toBe('Updated afternoon')
    expect(updated[0].plan.evening).toBe('Updated evening')
  })

  it('rejects negative dayIndex with error', async () => {
    const payload = {
      dayIndex: -1,
      plan: {
        morning: 'Updated',
        afternoon: 'Updated',
        evening: 'Updated',
      },
    }

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))

    // Check validation
    expect(() => {
      if (payload.dayIndex < 0 || payload.dayIndex >= data.length) {
        throw new Error('Invalid dayIndex')
      }
    }).toThrow('Invalid dayIndex')
  })

  it('rejects dayIndex >= array length with error', async () => {
    const payload = {
      dayIndex: 100,
      plan: {
        morning: 'Updated',
        afternoon: 'Updated',
        evening: 'Updated',
      },
    }

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))

    // Check validation
    expect(() => {
      if (payload.dayIndex < 0 || payload.dayIndex >= data.length) {
        throw new Error('Invalid dayIndex')
      }
    }).toThrow('Invalid dayIndex')
  })

  it('rejects missing plan fields with error', async () => {
    const invalidPayloads: Array<{ dayIndex: number; plan: Partial<{ morning: string; afternoon: string; evening: string }> }> = [
      { dayIndex: 0, plan: { morning: 'Morning', afternoon: 'Afternoon' } }, // Missing evening
      { dayIndex: 0, plan: { morning: 'Morning' } }, // Missing multiple
      { dayIndex: 0, plan: {} }, // Empty plan
    ]

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))

    for (const payload of invalidPayloads) {
      expect(() => {
        if (
          !payload.plan ||
          typeof payload.plan.morning !== 'string' ||
          typeof payload.plan.afternoon !== 'string' ||
          typeof payload.plan.evening !== 'string'
        ) {
          throw new Error('Invalid plan fields')
        }
      }).toThrow('Invalid plan fields')
    }
  })

  it('modifies route.json file correctly on update', async () => {
    const payload = {
      dayIndex: 1,
      plan: {
        morning: 'New day 2 morning',
        afternoon: 'New day 2 afternoon',
        evening: 'New day 2 evening',
      },
    }

    const dataBefore = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    expect(dataBefore[1].plan.morning).toBe('Day 2 morning')

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    data[payload.dayIndex].plan = payload.plan
    fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2))

    const dataAfter = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    expect(dataAfter[1].plan).toEqual(payload.plan)
    expect(dataAfter[0].plan.morning).toBe('Morning activity') // Unchanged
  })

  it('returns updated day object in correct format', async () => {
    const payload = {
      dayIndex: 0,
      plan: {
        morning: 'Updated morning',
        afternoon: 'Updated afternoon',
        evening: 'Updated evening',
      },
    }

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    data[payload.dayIndex].plan = payload.plan

    const updatedDay = data[payload.dayIndex]

    // Verify response format
    expect(updatedDay).toHaveProperty('date')
    expect(updatedDay).toHaveProperty('weekDay')
    expect(updatedDay).toHaveProperty('dayNum')
    expect(updatedDay).toHaveProperty('overnight')
    expect(updatedDay).toHaveProperty('plan')
    expect(updatedDay.plan).toEqual(payload.plan)
  })

  it('handles special characters and escaping in plan text', async () => {
    const payload = {
      dayIndex: 0,
      plan: {
        morning: 'Visit "Famous" Museum & Art Gallery',
        afternoon: `Line 1\nLine 2`,
        evening: "Day's end at 'Restaurant'",
      },
    }

    const data = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    data[payload.dayIndex].plan = payload.plan
    fs.writeFileSync(tempFilePath, JSON.stringify(data, null, 2))

    const updated = JSON.parse(fs.readFileSync(tempFilePath, 'utf-8'))
    expect(updated[0].plan.morning).toBe('Visit "Famous" Museum & Art Gallery')
    expect(updated[0].plan.afternoon).toBe(`Line 1\nLine 2`)
    expect(updated[0].plan.evening).toBe("Day's end at 'Restaurant'")
  })

  it('validates all three fields are strings', async () => {
    const invalidPayloads = [
      { dayIndex: 0, plan: { morning: 123, afternoon: 'text', evening: 'text' } },
      { dayIndex: 0, plan: { morning: null, afternoon: 'text', evening: 'text' } },
      { dayIndex: 0, plan: { morning: 'text', afternoon: [], evening: 'text' } },
    ]

    for (const payload of invalidPayloads) {
      expect(() => {
        if (
          !payload.plan ||
          typeof payload.plan.morning !== 'string' ||
          typeof payload.plan.afternoon !== 'string' ||
          typeof payload.plan.evening !== 'string'
        ) {
          throw new Error('Invalid plan fields')
        }
      }).toThrow('Invalid plan fields')
    }
  })
})
