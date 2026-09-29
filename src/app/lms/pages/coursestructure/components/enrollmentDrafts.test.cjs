// Run with Node 24+: node --test src/app/lms/pages/coursestructure/components/enrollmentDrafts.test.cjs
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { cohortKey, memberIds, copyPhaseSelections } = require('./enrollmentDrafts.ts')

const student = (id) => ({ user: { _id: id, role: { renameRole: 'Student' } } })
const trainer = (id) => ({ user: { _id: id, role: 'Trainer' } })
const batch = (phase, batchName, users = []) => ({ phase, batchName, users })
const key = (name) => cohortKey('Phase II', name)
const copy = (roster, checked = {}, initial = {}) =>
  copyPhaseSelections(roster, 'Phase I', 'Phase II', checked, initial)

test('copies every matching batch by name, even when target order differs', () => {
  const roster = [
    batch('Phase I', 'Batch I', [student('a'), trainer('t')]),
    batch('Phase I', 'Batch II', [student('b'), trainer('t')]),
    batch('Phase II', 'Batch II'), batch('Phase II', 'Batch I'),
  ]
  const before = structuredClone(roster)
  const result = copy(roster)
  assert.deepEqual(result.checked[key('Batch I')], ['a', 't'])
  assert.deepEqual(result.checked[key('Batch II')], ['b', 't'])
  assert.deepEqual(result.initial[key('Batch I')], [])
  assert.equal(result.added, 4)
  assert.equal(result.matchedBatches, 2)
  assert.deepEqual(roster, before, 'source enrolments must remain untouched')
})

test('preserves existing destination members and edits; repeating copy adds no duplicates', () => {
  const roster = [batch('Phase I', 'Batch I', [student('a')]),
    batch('Phase II', 'Batch I', [student('extra'), student('remove')])]
  const checked = { [key('Batch I')]: ['extra', 'new'] }
  const initial = { [key('Batch I')]: ['extra', 'remove'] }
  const result = copy(roster, checked, initial)
  assert.deepEqual(result.checked[key('Batch I')], ['extra', 'new', 'a'])
  assert.deepEqual(result.initial, initial)
  assert.deepEqual(checked[key('Batch I')], ['extra', 'new'], 'do not mutate previous state')
  assert.equal(copy(roster, result.checked, result.initial).added, 0)
})

test('checkbox edits after copying produce additions/removals only in the destination', () => {
  const roster = [batch('Phase I', 'Batch I', [student('a'), student('b')]),
    batch('Phase II', 'Batch I', [student('existing')])]
  const result = copy(roster)
  // User unticks a copied member and an existing member, then ticks an extra.
  result.checked[key('Batch I')] = ['b', 'extra']
  const selected = result.checked[key('Batch I')]
  const saved = result.initial[key('Batch I')]
  assert.deepEqual(selected.filter((id) => !saved.includes(id)), ['b', 'extra'])
  assert.deepEqual(saved.filter((id) => !selected.includes(id)), ['existing'])
  assert.deepEqual(memberIds(roster[0]), ['a', 'b'])
  assert.ok(!result.initial[cohortKey('Phase I', 'Batch I')])
})

test('skips students assigned to another destination batch, including unsaved picks', () => {
  const roster = [batch('Phase I', 'Batch I', [student('a'), student('b')]),
    batch('Phase II', 'Batch I'), batch('Phase II', 'Batch II', [student('a')])]
  const result = copy(roster, { [key('Batch II')]: ['a', 'b'] })
  assert.deepEqual(result.checked[key('Batch I')], [])
  assert.deepEqual(result.skippedUsers, ['a', 'b'])
})

test('a student unticked from another destination batch can be copied into the matching batch', () => {
  const roster = [batch('Phase I', 'Batch I', [student('a')]),
    batch('Phase II', 'Batch I'), batch('Phase II', 'Batch II', [student('a')])]
  const result = copy(roster, { [key('Batch II')]: [] }, { [key('Batch II')]: ['a'] })
  assert.deepEqual(result.checked[key('Batch I')], ['a'])
  assert.deepEqual(result.initial[key('Batch II')], ['a'])
  assert.deepEqual(result.checked[key('Batch II')], [])
})

test('reports missing batches without copying their users into an arbitrary batch', () => {
  const result = copy([batch('Phase I', 'Missing', [student('a')]), batch('Phase II', 'Batch I')])
  assert.deepEqual(result.unmatchedBatches, ['Missing'])
  assert.equal(result.added, 0)
  assert.deepEqual(result.checked, {})
})

test('copies saved source members, preserves source drafts, and tolerates deleted users', () => {
  const sourceKey = cohortKey('Phase I', 'Batch I')
  const checked = { [sourceKey]: ['unsaved'] }
  const result = copy([
    batch('Phase I', 'Batch I', [student('saved'), { user: null }, { user: 'raw-id' }, student('saved')]),
    batch('Phase II', 'Batch I'),
  ], checked)
  assert.deepEqual(result.checked[key('Batch I')], ['saved', 'raw-id'])
  assert.deepEqual(result.checked[sourceKey], ['unsaved'])
  assert.equal(result.added, 2)
})
