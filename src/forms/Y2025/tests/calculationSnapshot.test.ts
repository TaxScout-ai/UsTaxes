import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  rehearsalInformation,
  scenarioOneVariation
} from './fixtures/atsRehearsal'

describe('calculation snapshot v2', () => {
  it('exposes the Schedule H and Form 5695 lines behind 1040 lines 23 and 20', () => {
    const snapshot = calculationSnapshot(new F1040(scenarioOneVariation(), []))
    expect(snapshot.schemaVersion).toBe('ustaxes-1040-line-snapshot-v7')
    // Schedule H: 3,100 of cash wages at 12.4% and 2.9%, no FUTA.
    expect(snapshot.attachments.scheduleH?.lines).toMatchObject({
      '1': 3100,
      '2': 384,
      '3': 3100,
      '4': 90,
      '8': 474,
      schedule2: 474
    })
    expect(snapshot.attachments.schedule2.lines['9']).toBe(474)
    expect(snapshot.lines['23']).toBe(474)
    // Form 5695 Part II: doors capped at 500, windows 180, central AC 600;
    // 1,280 before the 1,200 annual limit, well under the tax on line 16.
    expect(snapshot.attachments.f5695?.lines).toMatchObject({
      '19h': 500,
      '20d': 180,
      '22d': 600,
      '27': 1280,
      '28': 1200,
      '32': 1200
    })
    expect(snapshot.attachments.schedule3.lines['5b']).toBe(1200)
    expect(snapshot.attachments.schedule3.lines['8']).toBe(1200)
    expect(snapshot.lines['20']).toBe(1200)
    expect(snapshot.lines['24']).toBe(2243)
    expect(snapshot.lines['35a']).toBe(470)
  })

  it('reports absent forms as null, not as zeros', () => {
    const snapshot = calculationSnapshot(new F1040(rehearsalInformation(), []))
    expect(snapshot.attachments.scheduleH).toBeNull()
    expect(snapshot.attachments.f5695).toBeNull()
    expect(snapshot.attachments.schedule2.lines['9']).toBeNull()
    expect(snapshot.attachments.schedule3.lines['5b']).toBeNull()
    expect(snapshot.lines['20']).toBeNull()
    // Line 23 is Schedule 2 line 21, a total: zero with nothing to add.
    expect(snapshot.lines['23']).toBe(0)
  })
})
