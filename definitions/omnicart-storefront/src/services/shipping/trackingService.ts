import omnicartError from '@/lib/util/omnicart-error';

export interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location?: string;
  timestamp: string;
  details?: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'unknown';
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackingEvent[];
  lastUpdated: string;
  recipientAddress?: {
    city: string;
    state: string;
    zip: string;
  };
}

export interface ShippingProvider {
  name: string;
  code: string;
  trackingUrlTemplate: string;
  apiEndpoint?: string;
}

// Supported shipping providers
export const SHIPPING_PROVIDERS: Record<string, ShippingProvider> = {
  ups: {
    name: 'UPS',
    code: 'ups',
    trackingUrlTemplate: 'https://www.ups.com/track?tracknum={trackingNumber}',
    apiEndpoint: 'https://onlinetools.ups.com/api/track'
  },
  fedex: {
    name: 'FedEx',
    code: 'fedex',
    trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?trknbr={trackingNumber}',
    apiEndpoint: 'https://api.fedex.com/track/v1/trackingnumbers'
  },
  usps: {
    name: 'USPS',
    code: 'usps',
    trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}',
    apiEndpoint: 'https://api.usps.com/tracking/v3/tracking'
  },
  dhl: {
    name: 'DHL',
    code: 'dhl',
    trackingUrlTemplate: 'https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id={trackingNumber}',
    apiEndpoint: 'https://api-eu.dhl.com/track/shipments'
  }
};

/**
 * Detect shipping provider from tracking number format
 */
export const detectShippingProvider = (trackingNumber: string): string => {
  const cleanNumber = trackingNumber.replace(/\s+/g, '').toUpperCase();
  
  // UPS tracking numbers
  if (/^1Z[0-9A-Z]{16}$/.test(cleanNumber)) {
    return 'ups';
  }
  
  // FedEx tracking numbers
  if (/^[0-9]{12}$/.test(cleanNumber) || /^[0-9]{14}$/.test(cleanNumber) || /^[0-9]{20}$/.test(cleanNumber)) {
    return 'fedex';
  }
  
  // USPS tracking numbers
  if (/^(94|93|92|94|95)[0-9]{20}$/.test(cleanNumber) || /^[A-Z]{2}[0-9]{9}US$/.test(cleanNumber)) {
    return 'usps';
  }
  
  // DHL tracking numbers
  if (/^[0-9]{10}$/.test(cleanNumber) || /^[0-9]{11}$/.test(cleanNumber)) {
    return 'dhl';
  }
  
  return 'unknown';
};

/**
 * Get tracking URL for a given provider and tracking number
 */
export const getTrackingUrl = (provider: string, trackingNumber: string): string => {
  const providerInfo = SHIPPING_PROVIDERS[provider];
  if (!providerInfo) {
    return '#';
  }
  
  return providerInfo.trackingUrlTemplate.replace('{trackingNumber}', trackingNumber);
};

/**
 * Mock tracking data for demonstration (replace with real API calls)
 */
const generateMockTrackingData = (trackingNumber: string, provider: string): TrackingInfo => {
  const now = new Date();
  const events: TrackingEvent[] = [
    {
      id: '1',
      status: 'label_created',
      description: 'Shipping label created',
      location: 'Origin facility',
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      details: 'Package information received'
    },
    {
      id: '2',
      status: 'picked_up',
      description: 'Package picked up',
      location: 'Origin facility',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      details: 'Package picked up by carrier'
    },
    {
      id: '3',
      status: 'in_transit',
      description: 'In transit',
      location: 'Distribution center',
      timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      details: 'Package is on its way to destination'
    },
    {
      id: '4',
      status: 'out_for_delivery',
      description: 'Out for delivery',
      location: 'Local facility',
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      details: 'Package is out for delivery'
    }
  ];

  return {
    trackingNumber,
    carrier: SHIPPING_PROVIDERS[provider]?.name || 'Unknown',
    status: 'out_for_delivery',
    estimatedDelivery: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    events,
    lastUpdated: new Date().toISOString(),
    recipientAddress: {
      city: 'New York',
      state: 'NY',
      zip: '10001'
    }
  };
};

/**
 * Track package using tracking number
 */
export const trackPackage = async (trackingNumber: string): Promise<TrackingInfo> => {
  try {
    const provider = detectShippingProvider(trackingNumber);
    
    if (provider === 'unknown') {
      throw new Error('Unable to detect shipping provider from tracking number');
    }

    // In a real implementation, you would make API calls to the respective shipping providers
    // For now, we'll return mock data
    const trackingInfo = generateMockTrackingData(trackingNumber, provider);
    
    return trackingInfo;
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Get tracking information for multiple tracking numbers
 */
export const trackMultiplePackages = async (trackingNumbers: string[]): Promise<TrackingInfo[]> => {
  try {
    const trackingPromises = trackingNumbers.map(trackingNumber => 
      trackPackage(trackingNumber)
    );
    
    const results = await Promise.allSettled(trackingPromises);
    
    return results
      .filter((result): result is PromiseFulfilledResult<TrackingInfo> => result.status === 'fulfilled')
      .map(result => result.value);
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Get status color for UI display
 */
export const getStatusColor = (status: TrackingInfo['status']): string => {
  switch (status) {
    case 'pending':
      return 'text-gray-600 bg-gray-100';
    case 'in_transit':
      return 'text-blue-600 bg-blue-100';
    case 'out_for_delivery':
      return 'text-orange-600 bg-orange-100';
    case 'delivered':
      return 'text-green-600 bg-green-100';
    case 'exception':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

/**
 * Get status icon for UI display
 */
export const getStatusIcon = (status: TrackingInfo['status']): string => {
  switch (status) {
    case 'pending':
      return 'clock';
    case 'in_transit':
      return 'truck';
    case 'out_for_delivery':
      return 'package';
    case 'delivered':
      return 'check-circle';
    case 'exception':
      return 'alert-circle';
    default:
      return 'help-circle';
  }
};

/**
 * Format tracking status for display
 */
export const formatTrackingStatus = (status: TrackingInfo['status']): string => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'in_transit':
      return 'In Transit';
    case 'out_for_delivery':
      return 'Out for Delivery';
    case 'delivered':
      return 'Delivered';
    case 'exception':
      return 'Exception';
    default:
      return 'Unknown';
  }
};
