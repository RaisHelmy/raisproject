import type { Vehicle } from '../types'

// Fuel: RON95 ≈ RM2.05/L. Public DC charging ≈ RM1.20/kWh, home AC ≈ RM0.45/kWh.
export const VEHICLES: Vehicle[] = [
  { id: 'small', name: 'Small car (Axia / Myvi)', kind: 'petrol', consumption: 19, fuelPrice: 2.05, seats: 4 },
  { id: 'sedan', name: 'Sedan (City / Vios)', kind: 'petrol', consumption: 17, fuelPrice: 2.05, seats: 4 },
  { id: 'hybrid', name: 'Hybrid sedan (City RS)', kind: 'petrol', consumption: 24, fuelPrice: 2.05, seats: 4 },
  { id: 'suv', name: 'SUV (X50 / CR-V)', kind: 'petrol', consumption: 13, fuelPrice: 2.05, seats: 5 },
  { id: 'mpv', name: 'MPV (Alza / Serena)', kind: 'petrol', consumption: 13, fuelPrice: 2.05, seats: 7 },
  { id: 'ev', name: 'EV (BYD Atto 3 / Model 3)', kind: 'ev', consumption: 16, fuelPrice: 1.2, seats: 5 },
  { id: 'ev-home', name: 'EV (mostly home charging)', kind: 'ev', consumption: 16, fuelPrice: 0.6, seats: 5 },
  { id: 'motorcycle', name: 'Motorcycle', kind: 'motorcycle', consumption: 40, fuelPrice: 2.05, seats: 2 },
]

export function getVehicle(id: string): Vehicle {
  return VEHICLES.find((v) => v.id === id) ?? VEHICLES[1]
}

export function fuelCostForKm(v: Vehicle, km: number): number {
  if (v.kind === 'ev') {
    const kwh = (km / 100) * v.consumption
    return kwh * v.fuelPrice
  }
  return (km / v.consumption) * v.fuelPrice
}

export function evChargeStops(km: number, usableRangeKm = 350): number {
  return Math.max(0, Math.ceil(km / usableRangeKm) - 1)
}
