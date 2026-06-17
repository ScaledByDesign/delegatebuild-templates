import { omnicartClient } from "../../lib/omnicart-client"
import omnicartError from "../../lib/util/omnicart-error"

export interface OmnicartRegion {
  id: string
  name: string
  currency_code: string
  tax_rate: number
  countries: {
    id: string
    iso_2: string
    iso_3: string
    name: string
    display_name: string
  }[]
  payment_providers: {
    id: string
    is_enabled: boolean
  }[]
  fulfillment_providers: {
    id: string
    is_enabled: boolean
  }[]
  created_at: string
  updated_at: string
}

export interface RegionsResponse {
  regions: OmnicartRegion[]
}

/**
 * List all regions
 */
export const listRegions = async (): Promise<OmnicartRegion[]> => {
  try {
    const response = await omnicartClient.get<RegionsResponse>(
      "/store/regions",
      {
        cache: "force-cache",
      }
    )

    return response.regions
  } catch (error) {
    console.error('Error fetching regions:', error)
    throw omnicartError(error)
  }
}

/**
 * Get region by ID
 */
export const getRegion = async (regionId: string): Promise<OmnicartRegion> => {
  try {
    const response = await omnicartClient.get<{ region: OmnicartRegion }>(
      `/store/regions/${regionId}`,
      {
        cache: "force-cache",
      }
    )

    return response.region
  } catch (error) {
    console.error('Error fetching region:', error)
    throw omnicartError(error)
  }
}

/**
 * Get region by country code
 */
export const getRegionByCountry = async (countryCode: string): Promise<OmnicartRegion | null> => {
  try {
    const regions = await listRegions()
    
    const region = regions.find(region => 
      region.countries.some(country => 
        country.iso_2.toLowerCase() === countryCode.toLowerCase()
      )
    )

    return region || null
  } catch (error) {
    console.error('Error fetching region by country:', error)
    return null
  }
}

/**
 * Get default region (first available region)
 */
export const getDefaultRegion = async (): Promise<OmnicartRegion | null> => {
  try {
    const regions = await listRegions()
    return regions.length > 0 ? regions[0] : null
  } catch (error) {
    console.error('Error fetching default region:', error)
    return null
  }
}
