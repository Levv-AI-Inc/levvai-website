import type { Tab, TableConfig } from './types'

export function getTableConfig(activeTab: Tab): TableConfig {
  switch (activeTab) {
    case 'Business Units':
      return {
        title: 'Business units',
        addLabel: 'Add business unit',
        columns: [{ key: 'businessUnit', label: 'Business unit' }],
        rows: [
          { businessUnit: 'Technology', status: 'Active' },
          { businessUnit: 'Operations', status: 'Inactive' },
        ],
      }

    case 'Cost Centers':
      return {
        title: 'Cost centers',
        addLabel: 'Add cost center',
        columns: [
          { key: 'costCenter', label: 'Cost center' },
          { key: 'erpId', label: 'ERP ID' },
        ],
        rows: [
          { costCenter: 'IT-1001', erpId: 'CC-7781', status: 'Active' },
          { costCenter: 'OPS-2003', erpId: 'CC-8820', status: 'Inactive' },
        ],
      }

    case 'Locations':
      return {
        title: 'Locations',
        addLabel: 'Add location',
        columns: [
          { key: 'location', label: 'Location' },
          { key: 'country', label: 'Country' },
          { key: 'region', label: 'Region' },
        ],
        rows: [
          {
            location: 'New York',
            country: 'USA',
            region: 'North America',
            status: 'Active',
          },
          {
            location: 'London',
            country: 'UK',
            region: 'EMEA',
            status: 'Active',
          },
        ],
      }

    case 'Worksites':
      return {
        title: 'Worksites',
        addLabel: 'Add worksite',
        columns: [
          { key: 'worksite', label: 'Worksite' },
          { key: 'country', label: 'Country' },
          { key: 'legalEntity', label: 'Legal entity' },
        ],
        rows: [],
      }

    case 'Legal Entities':
      return {
        title: 'Legal entities',
        addLabel: 'Add legal entity',
        columns: [
          { key: 'legalEntity', label: 'Legal entity' },
          { key: 'legalEntityId', label: 'Legal entity ID' },
          { key: 'country', label: 'Country' },
        ],
        rows: [],
      }

    case 'Subsidiaries':
      return {
        title: 'Subsidiaries',
        addLabel: 'Add subsidiary',
        columns: [
          { key: 'subsidiary', label: 'Subsidiary' },
          { key: 'displayName', label: 'Display name' },
          { key: 'erpId', label: 'ERP ID' },
          { key: 'paymentsOnboarding', label: 'Payments onboarding' },
        ],
        rows: [
          {
            subsidiary: 'Dummy Subsidiary 1',
            displayName: 'Subsidiary 1',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Dummy Subsidiary 2',
            displayName: 'Subsidiary 2',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Zip Child Subsidiary',
            displayName: 'Zip LLC',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Inactive',
          },
          {
            subsidiary: 'Honeycomb Manufacturing Inc.',
            displayName: '-',
            erpId: '-',
            paymentsOnboarding: '-',
            status: 'Active',
          },
        ],
      }

    default:
      return {
        title: 'Company',
        addLabel: 'Add',
        columns: [{ key: 'name', label: 'Name' }],
        rows: [{ name: 'Example', status: 'Active' }],
      }
  }
}
