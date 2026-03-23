import type { StayLocation, StayLocationInput } from './itinerary-store/types'

function toTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function buildCustomStayLocation(rawValue: string): StayLocation {
  const trimmed = rawValue.trim()
  return {
    kind: 'custom',
    label: trimmed,
    queryText: trimmed,
  }
}

export function normalizeStayLocation(city: string, location?: StayLocationInput | null): StayLocation {
  const trimmedCity = city.trim()

  if (!location || location.kind === 'custom') {
    return {
      kind: 'custom',
      label: trimmedCity,
      queryText: trimmedCity,
    }
  }

  if (location.kind === 'resolved') {
    const label = toTrimmed(location.label)
    const queryText = typeof location.queryText === 'string' ? location.queryText.trim() : trimmedCity
    const placeId = toTrimmed(location.place?.placeId)
    const name = toTrimmed(location.place?.name)

    if (
      label.length === 0 ||
      label !== trimmedCity ||
      placeId.length === 0 ||
      name.length === 0 ||
      !Number.isFinite(location.coordinates?.lng) ||
      !Number.isFinite(location.coordinates?.lat)
    ) {
      return {
        kind: 'custom',
        label: trimmedCity,
        queryText: trimmedCity,
      }
    }

    return {
      kind: 'resolved',
      label,
      queryText,
      coordinates: {
        lng: location.coordinates.lng,
        lat: location.coordinates.lat,
      },
      place: {
        placeId,
        name,
        locality: toTrimmed(location.place.locality) || undefined,
        region: toTrimmed(location.place.region) || undefined,
        country: toTrimmed(location.place.country) || undefined,
        countryCode: toTrimmed(location.place.countryCode).toUpperCase() || undefined,
        featureType:
          location.place.featureType === 'locality' ||
          location.place.featureType === 'region' ||
          location.place.featureType === 'country' ||
          location.place.featureType === 'other'
            ? location.place.featureType
            : undefined,
      },
    }
  }

  if (location.kind === 'geonames') {
    const label = toTrimmed(location.label)
    const queryText = typeof location.queryText === 'string' ? location.queryText.trim() : trimmedCity
    const geonameId = location.place?.geonameId
    const name = toTrimmed(location.place?.name)

    if (
      label.length === 0 ||
      label !== trimmedCity ||
      typeof geonameId !== 'number' ||
      !Number.isFinite(geonameId) ||
      name.length === 0 ||
      !Number.isFinite(location.coordinates?.lng) ||
      !Number.isFinite(location.coordinates?.lat)
    ) {
      return {
        kind: 'custom',
        label: trimmedCity,
        queryText: trimmedCity,
      }
    }

    return {
      kind: 'resolved',
      label,
      queryText,
      coordinates: {
        lng: location.coordinates.lng,
        lat: location.coordinates.lat,
      },
      place: {
        placeId: `geonames:${geonameId}`,
        name,
        locality: toTrimmed(location.place.toponymName) || undefined,
        country: toTrimmed(location.place.countryName) || undefined,
        countryCode: toTrimmed(location.place.countryCode) || undefined,
        region: toTrimmed(location.place.adminName1) || undefined,
        featureType: 'locality',
      },
    }
  }

  const label = toTrimmed(location.label)
  const queryText = typeof location.queryText === 'string' ? location.queryText : trimmedCity
  const mapboxId = toTrimmed(location.place?.mapboxId)
  const fullName = toTrimmed(location.place?.fullName)
  const placeType = Array.isArray(location.place?.placeType)
    ? location.place.placeType.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  if (
    label.length === 0 ||
    label !== trimmedCity ||
    mapboxId.length === 0 ||
    fullName.length === 0 ||
    !Number.isFinite(location.coordinates?.lng) ||
    !Number.isFinite(location.coordinates?.lat)
  ) {
    return {
      kind: 'custom',
      label: trimmedCity,
      queryText: trimmedCity,
    }
  }

  return {
    kind: 'resolved',
    label,
    queryText,
    coordinates: {
      lng: location.coordinates.lng,
      lat: location.coordinates.lat,
    },
    place: {
      placeId: mapboxId,
      name: fullName,
      locality: toTrimmed(location.place.locality) || undefined,
      region: toTrimmed(location.place.region) || undefined,
      country: toTrimmed(location.place.country) || undefined,
      countryCode: toTrimmed(location.place.countryCode) || undefined,
      featureType: placeType.includes('country')
        ? 'country'
        : placeType.includes('region')
          ? 'region'
          : placeType.includes('place') || placeType.includes('locality')
            ? 'locality'
            : 'other',
    },
  }
}

export function isLocationLabelSyncedWithCity(city: string, location?: StayLocation | null): boolean {
  if (!location) return false
  return location.label.trim() === city.trim()
}
