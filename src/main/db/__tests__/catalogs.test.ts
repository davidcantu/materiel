import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ACTION_MANUFACTURERS,
  AR_MANUFACTURERS,
  BARREL_MANUFACTURERS,
  BRASS_MANUFACTURERS,
  BULLET_MANUFACTURERS,
  FACTORY_AMMO_MANUFACTURERS,
  MUZZLE_BRAKE_MANUFACTURERS,
  OPTIC_MANUFACTURERS,
  PISTOL_CALIBER_OPTIONS,
  PISTOL_MANUFACTURERS,
  POWDER_MANUFACTURERS,
  PRIMER_MANUFACTURERS,
  SUPPRESSOR_MANUFACTURERS,
  factoryManufacturersForPlatform,
  manufacturersForPartType
} from '../../../shared/catalogs'

describe('manufacturer catalogs', () => {
  it('uses Cap Case SIG Sauer (not Sig Sauer)', () => {
    assert.ok(PISTOL_MANUFACTURERS.includes('SIG Sauer'))
    assert.ok(OPTIC_MANUFACTURERS.includes('SIG Sauer'))
    assert.ok(SUPPRESSOR_MANUFACTURERS.includes('SIG Sauer'))
    assert.ok(FACTORY_AMMO_MANUFACTURERS.includes('SIG Sauer'))
    assert.ok(!(SUPPRESSOR_MANUFACTURERS as readonly string[]).includes('Sig Sauer'))
  })

  it('maps part types to category suggestion lists', () => {
    assert.deepEqual(manufacturersForPartType('Action'), [...ACTION_MANUFACTURERS])
    assert.deepEqual(manufacturersForPartType('Barrel'), [...BARREL_MANUFACTURERS])
    assert.deepEqual(manufacturersForPartType('Optic'), [...OPTIC_MANUFACTURERS])
    assert.deepEqual(manufacturersForPartType('Lower'), [...AR_MANUFACTURERS])
    assert.deepEqual(manufacturersForPartType('Pistol'), [...PISTOL_MANUFACTURERS])
    assert.deepEqual(manufacturersForPartType('Suppressor', 'Suppressor'), [
      ...SUPPRESSOR_MANUFACTURERS
    ])
    assert.deepEqual(manufacturersForPartType('Suppressor', 'Brake'), [
      ...MUZZLE_BRAKE_MANUFACTURERS
    ])
    assert.ok(manufacturersForPartType('Trigger').includes('Bix & Andy'))
    assert.ok(manufacturersForPartType('LaserIR').includes('SureFire'))
    assert.ok(manufacturersForPartType('Misc').includes('Atlas'))
    assert.equal(manufacturersForPartType('Unknown').length, 0)
  })

  it('suggests factory firearm brands by platform', () => {
    assert.deepEqual(factoryManufacturersForPlatform('bolt_action'), [...ACTION_MANUFACTURERS])
    assert.deepEqual(factoryManufacturersForPlatform('ar_pattern'), [...AR_MANUFACTURERS])
    assert.deepEqual(factoryManufacturersForPlatform('pistol'), [...PISTOL_MANUFACTURERS])
  })

  it('lists ten common pistol calibers including 9mm and 10mm', () => {
    assert.equal(PISTOL_CALIBER_OPTIONS.length, 10)
    assert.ok(PISTOL_CALIBER_OPTIONS.includes('9mm'))
    assert.ok(PISTOL_CALIBER_OPTIONS.includes('10mm'))
  })

  it('keeps approved reloading / factory ammo brand lists', () => {
    assert.ok(BULLET_MANUFACTURERS.includes('Barnes'))
    assert.ok(BULLET_MANUFACTURERS.includes('Lapua'))
    assert.ok(!(BULLET_MANUFACTURERS as readonly string[]).includes('Hammer Bullets'))
    assert.ok(BRASS_MANUFACTURERS.includes('ADG'))
    assert.ok(BRASS_MANUFACTURERS.includes('Norma'))
    assert.ok(!(BRASS_MANUFACTURERS as readonly string[]).includes('Norma Ammunition'))
    assert.ok(POWDER_MANUFACTURERS.includes('Shooters World'))
    assert.ok(PRIMER_MANUFACTURERS.includes('Winchester'))
    assert.ok(FACTORY_AMMO_MANUFACTURERS.includes('Sellier & Bellot'))
    assert.ok(MUZZLE_BRAKE_MANUFACTURERS.includes('DemiGod Precision'))
    assert.ok(BARREL_MANUFACTURERS.includes('ACE'))
    assert.ok(AR_MANUFACTURERS.includes('SOLGW'))
    assert.ok(AR_MANUFACTURERS.includes('POF'))
    assert.ok(AR_MANUFACTURERS.includes('LMT'))
  })
})
