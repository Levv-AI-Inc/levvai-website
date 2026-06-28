'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AIRulesPanel from './components/AIRulesPanel'
import AddBusinessUnitModal, {
  type AddBusinessUnitFormValues,
} from './components/AddBusinessUnitModal'
import AddCostCenterModal, {
  type AddCostCenterFormValues,
} from './components/AddCostCenterModal'
import AddLegalEntityModal, {
  type AddLegalEntityFormValues,
} from './components/AddLegalEntityModal'
import AddLocationModal, {
  type AddLocationFormValues,
} from './components/AddLocationModal'
import AddSiteModal, {
  type AddSiteFormValues,
} from './components/AddSiteModal'
import CompanyHeader from './components/CompanyHeader'
import CompanyTable from './components/CompanyTable'
import CompanyTabs from './components/CompanyTabs'
import WorksiteActionsDropdown from './components/WorksiteActionsDropdown'
import { getTableConfig } from './config'
import { TABS, type RowStatus, type Tab } from './types'
import { Pencil, Trash2 } from 'lucide-react'
import {
  BusinessUnitsApiError,
  createBusinessUnit,
  getBusinessUnits,
  type BusinessUnitCreatePayload,
  type BusinessUnitRecord,
} from '@/lib/api/businessUnits'
import {
  CostCentersApiError,
  createCostCenter,
  getCostCenters,
  type CostCenterCreatePayload,
  type CostCenterRecord,
} from '@/lib/api/costCenters'
import {
  LegalEntitiesApiError,
  createLegalEntity,
  getLegalEntities,
  type LegalEntityCreatePayload,
  type LegalEntityRecord,
} from '@/lib/api/legalEntities'
import {
  createLocation,
  deleteLocation,
  getLocations,
  LocationsApiError,
  type LocationCreatePayload,
  type LocationRecord,
  type LocationStatus,
  type LocationUpdatePayload,
  updateLocation,
} from '@/lib/api/locations'
import {
  createSite,
  getSites,
  SitesApiError,
  type SiteCreatePayload,
  type SiteRecord,
  updateSite,
} from '@/lib/api/sites'

function toRowStatus(value: string | undefined): RowStatus {
  return value?.toLowerCase() === 'active' ? 'Active' : 'Inactive'
}

function mapBusinessUnitsToRows(rows: BusinessUnitRecord[]) {
  return rows.map((unit) => ({
    businessUnit: unit.code
      ? `${unit.name} (${unit.code})`
      : unit.name,
    status: toRowStatus(unit.status),
  }))
}

function mapCostCentersToRows(rows: CostCenterRecord[]) {
  return rows.map((center) => ({
    costCenter: center.code
      ? `${center.name} (${center.code})`
      : center.name,
    erpId: center.erp_code || '-',
    status: toRowStatus(center.status),
  }))
}

function mapLocationsToRows(rows: LocationRecord[]) {
  return rows.map((location) => ({
    id: location.id,
    location: location.name,
    country: location.country || '-',
    region: location.region || '-',
    status: toRowStatus(location.status),
    locationRecord: location,
  }))
}

function mapSitesToRows(rows: SiteRecord[]) {
  return rows.map((site) => ({
    id: site.id,
    worksite: site.code ? `${site.name} (${site.code})` : site.name,
    country: site.country || '-',
    legalEntity: site.legal_entity || '-',
    status: toRowStatus(site.status),
    siteRecord: site,
  }))
}

function mapLegalEntitiesToRows(rows: LegalEntityRecord[]) {
  return rows.map((entity) => ({
    legalEntity: entity.name,
    legalEntityId: entity.id || '-',
    country: entity.country || '-',
    status: toRowStatus(entity.status),
  }))
}

function toCreatePayload(
  values: AddBusinessUnitFormValues,
): BusinessUnitCreatePayload {
  const companyValue = values.company.trim()
  const parsedCompany = companyValue ? Number(companyValue) : NaN

  return {
    code: values.code.trim(),
    name: values.name.trim(),
    parent: values.parent.trim() || null,
    description: values.description.trim() || undefined,
    legal_entity_id: values.legalEntityId.trim() || undefined,
    gl_account_id: values.glAccountId.trim() || undefined,
    status: values.status.trim() || undefined,
    company: Number.isFinite(parsedCompany) ? parsedCompany : undefined,
  }
}

function readUploadString(
  row: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function toCreateCostCenterPayload(
  values: AddCostCenterFormValues,
): CostCenterCreatePayload {
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    owner_email: values.ownerEmail.trim(),
    description: values.description.trim() || undefined,
    business_unit: values.businessUnit.trim() || undefined,
    currency: values.currency.trim() || undefined,
    status: values.status.trim() || undefined,
    budget_amount: values.budgetAmount.trim() || undefined,
    budget_period: values.budgetPeriod.trim() || undefined,
    gl_account_id: values.glAccountId.trim() || undefined,
    erp_code: values.erpCode.trim() || undefined,
    legal_entity_id: values.legalEntityId.trim() || undefined,
  }
}

function toCreateLegalEntityPayload(
  values: AddLegalEntityFormValues,
): LegalEntityCreatePayload {
  const billingAddress = {
    line1: values.billingLine1.trim() || undefined,
    line2: values.billingLine2.trim() || undefined,
    city: values.billingCity.trim() || undefined,
    state_province: values.billingStateProvince.trim() || undefined,
    postal_code: values.billingPostalCode.trim() || undefined,
    country: values.billingCountry.trim().toUpperCase() || undefined,
  }

  const hasBillingAddress = Object.values(billingAddress).some(Boolean)

  return {
    id: values.id.trim(),
    name: values.name.trim(),
    country: values.country.trim().toUpperCase(),
    currency: values.currency.trim().toUpperCase(),
    tax_id: values.taxId.trim() || undefined,
    erp_code: values.erpCode.trim() || undefined,
    status: values.status.trim() || undefined,
    billing_address: hasBillingAddress ? billingAddress : undefined,
  }
}

function toLocationStatus(value: string): LocationStatus {
  return value.trim().toLowerCase() === 'inactive' ? 'inactive' : 'active'
}

function isLocationStatus(value: string): value is LocationStatus {
  return value === 'active' || value === 'inactive'
}

function toLocationPayload(
  values: AddLocationFormValues,
): LocationCreatePayload {
  return {
    name: values.name.trim(),
    country: values.country.trim(),
    region: values.region.trim(),
    status: toLocationStatus(values.status),
  }
}

function toLocationUpdatePayload(
  values: AddLocationFormValues,
): LocationUpdatePayload {
  return toLocationPayload(values)
}

function toLocationFormValues(
  location: LocationRecord,
): AddLocationFormValues {
  return {
    name: location.name || '',
    country: location.country || '',
    region: location.region || '',
    status: location.status || 'active',
  }
}

function toCreateSitePayload(values: AddSiteFormValues): SiteCreatePayload {
  const taxConfig = {
    vat: values.taxVat.trim() || undefined,
    jurisdiction: values.taxJurisdiction.trim() || undefined,
    tax_id: values.taxId.trim() || undefined,
  }

  const hasTaxConfig = Object.values(taxConfig).some(Boolean)

  return {
    code: values.code.trim(),
    name: values.name.trim(),
    status: values.status.trim() || undefined,
    address_line1: values.addressLine1.trim(),
    address_line2: values.addressLine2.trim() || undefined,
    city: values.city.trim(),
    state_province: values.stateProvince.trim(),
    country: values.country.trim().toUpperCase(),
    postal_code: values.postalCode.trim(),
    latitude: values.latitude.trim() || undefined,
    longitude: values.longitude.trim() || undefined,
    timezone: values.timezone.trim(),
    hours_per_day: values.hoursPerDay.trim() || undefined,
    hours_per_week: values.hoursPerWeek.trim() || undefined,
    currency: values.currency.trim().toUpperCase() || undefined,
    legal_entity: values.legalEntity.trim() || undefined,
    tax_config: hasTaxConfig ? taxConfig : undefined,
    erp_code: values.erpCode.trim() || undefined,
  }
}

function toSiteFormValues(site: SiteRecord): AddSiteFormValues {
  const taxConfig =
    site.tax_config && typeof site.tax_config === 'object'
      ? site.tax_config
      : {}

  return {
    code: site.code || '',
    name: site.name || '',
    status: site.status || 'active',
    addressLine1: site.address_line1 || '',
    addressLine2: site.address_line2 || '',
    city: site.city || '',
    stateProvince: site.state_province || '',
    country: site.country || '',
    postalCode: site.postal_code || '',
    timezone: site.timezone || '',
    latitude: site.latitude || '',
    longitude: site.longitude || '',
    hoursPerDay: site.hours_per_day || '',
    hoursPerWeek: site.hours_per_week || '',
    currency: site.currency || '',
    legalEntity: site.legal_entity || '',
    erpCode: site.erp_code || '',
    taxJurisdiction:
      typeof taxConfig.jurisdiction === 'string'
        ? taxConfig.jurisdiction
        : '',
    taxId:
      typeof taxConfig.tax_id === 'string'
        ? taxConfig.tax_id
        : '',
    taxVat:
      typeof taxConfig.vat === 'string'
        ? taxConfig.vat
        : '',
  }
}

export default function CompanyPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('Business Units')

  const [businessUnits, setBusinessUnits] = useState<BusinessUnitRecord[]>([])
  const [businessUnitsLoading, setBusinessUnitsLoading] = useState(false)
  const [businessUnitsError, setBusinessUnitsError] = useState('')
  const [businessUnitsLoaded, setBusinessUnitsLoaded] = useState(false)
  const [costCenters, setCostCenters] = useState<CostCenterRecord[]>([])
  const [costCentersLoading, setCostCentersLoading] = useState(false)
  const [costCentersError, setCostCentersError] = useState('')
  const [costCentersLoaded, setCostCentersLoaded] = useState(false)
  const [locations, setLocations] = useState<LocationRecord[]>([])
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [locationsError, setLocationsError] = useState('')
  const [locationsLoaded, setLocationsLoaded] = useState(false)
  const [sites, setSites] = useState<SiteRecord[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [sitesError, setSitesError] = useState('')
  const [sitesLoaded, setSitesLoaded] = useState(false)
  const [legalEntities, setLegalEntities] = useState<LegalEntityRecord[]>([])
  const [legalEntitiesLoading, setLegalEntitiesLoading] = useState(false)
  const [legalEntitiesError, setLegalEntitiesError] = useState('')
  const [legalEntitiesLoaded, setLegalEntitiesLoaded] = useState(false)

  const [showAddBusinessUnitModal, setShowAddBusinessUnitModal] =
    useState(false)
  const [creatingBusinessUnit, setCreatingBusinessUnit] = useState(false)
  const [addBusinessUnitError, setAddBusinessUnitError] = useState('')
  const [showAddCostCenterModal, setShowAddCostCenterModal] = useState(false)
  const [creatingCostCenter, setCreatingCostCenter] = useState(false)
  const [addCostCenterError, setAddCostCenterError] = useState('')
  const [showAddLocationModal, setShowAddLocationModal] = useState(false)
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [addLocationError, setAddLocationError] = useState('')
  const [editingLocation, setEditingLocation] =
    useState<LocationRecord | null>(null)
  const [deletingLocationId, setDeletingLocationId] = useState<number | null>(
    null,
  )
  const [showAddSiteModal, setShowAddSiteModal] = useState(false)
  const [creatingSite, setCreatingSite] = useState(false)
  const [addSiteError, setAddSiteError] = useState('')
  const [editingSite, setEditingSite] = useState<SiteRecord | null>(null)
  const [showAddLegalEntityModal, setShowAddLegalEntityModal] =
    useState(false)
  const [creatingLegalEntity, setCreatingLegalEntity] = useState(false)
  const [addLegalEntityError, setAddLegalEntityError] = useState('')
  const [uploadingBusinessUnits, setUploadingBusinessUnits] = useState(false)
  const [businessUnitUploadError, setBusinessUnitUploadError] = useState('')

  const refreshBusinessUnits = useCallback(async () => {
    setBusinessUnitsLoading(true)
    setBusinessUnitsError('')

    try {
      const rows = await getBusinessUnits()
      setBusinessUnits(rows)
      setBusinessUnitsLoaded(true)
    } catch (error) {
      setBusinessUnitsLoaded(true)

      if (error instanceof BusinessUnitsApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof BusinessUnitsApiError && error.status === 403) {
        setBusinessUnitsError(
          'You do not have permission to view business units.',
        )
        return
      }

      setBusinessUnitsError(
        error instanceof Error
          ? error.message
          : 'Unable to load business units.',
      )
    } finally {
      setBusinessUnitsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refreshBusinessUnits()
  }, [refreshBusinessUnits])

  const refreshCostCenters = useCallback(async () => {
    setCostCentersLoading(true)
    setCostCentersError('')

    try {
      const rows = await getCostCenters()
      setCostCenters(rows)
      setCostCentersLoaded(true)
    } catch (error) {
      setCostCentersLoaded(true)

      if (error instanceof CostCentersApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof CostCentersApiError && error.status === 403) {
        setCostCentersError(
          'You do not have permission to view cost centers.',
        )
        return
      }

      setCostCentersError(
        error instanceof Error
          ? error.message
          : 'Unable to load cost centers.',
      )
    } finally {
      setCostCentersLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refreshCostCenters()
  }, [refreshCostCenters])

  const refreshLocations = useCallback(async () => {
    setLocationsLoading(true)
    setLocationsError('')

    try {
      const rows = await getLocations()
      setLocations(rows)
      setLocationsLoaded(true)
    } catch (error) {
      setLocationsLoaded(true)

      if (error instanceof LocationsApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof LocationsApiError && error.status === 403) {
        setLocationsError('You do not have permission to view locations.')
        return
      }

      setLocationsError(
        error instanceof Error
          ? error.message
          : 'Unable to load locations.',
      )
    } finally {
      setLocationsLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refreshLocations()
  }, [refreshLocations])

  const refreshSites = useCallback(async () => {
    setSitesLoading(true)
    setSitesError('')

    try {
      const rows = await getSites()
      setSites(rows)
      setSitesLoaded(true)
    } catch (error) {
      setSitesLoaded(true)

      if (error instanceof SitesApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof SitesApiError && error.status === 403) {
        setSitesError('You do not have permission to view worksites.')
        return
      }

      setSitesError(
        error instanceof Error ? error.message : 'Unable to load worksites.',
      )
    } finally {
      setSitesLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refreshSites()
  }, [refreshSites])

  const refreshLegalEntities = useCallback(async () => {
    setLegalEntitiesLoading(true)
    setLegalEntitiesError('')

    try {
      const rows = await getLegalEntities()
      setLegalEntities(rows)
      setLegalEntitiesLoaded(true)
    } catch (error) {
      setLegalEntitiesLoaded(true)

      if (
        error instanceof LegalEntitiesApiError &&
        error.status === 401
      ) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (
        error instanceof LegalEntitiesApiError &&
        error.status === 403
      ) {
        setLegalEntitiesError(
          'You do not have permission to view legal entities.',
        )
        return
      }

      setLegalEntitiesError(
        error instanceof Error
          ? error.message
          : 'Unable to load legal entities.',
      )
    } finally {
      setLegalEntitiesLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refreshLegalEntities()
  }, [refreshLegalEntities])

  const config = useMemo(() => {
    const base = getTableConfig(activeTab)
    if (activeTab === 'Business Units') {
      if (!businessUnitsLoaded || businessUnitsError) return base

      return {
        ...base,
        rows: mapBusinessUnitsToRows(businessUnits),
      }
    }

    if (activeTab === 'Cost Centers') {
      if (!costCentersLoaded || costCentersError) return base

      return {
        ...base,
        rows: mapCostCentersToRows(costCenters),
      }
    }

    if (activeTab === 'Locations') {
      if (!locationsLoaded || locationsError) {
        return {
          ...base,
          rows: [],
        }
      }

      return {
        ...base,
        rows: mapLocationsToRows(locations),
      }
    }

    if (activeTab === 'Worksites') {
      if (!sitesLoaded || sitesError) return base

      return {
        ...base,
        rows: mapSitesToRows(sites),
      }
    }

    if (activeTab === 'Legal Entities') {
      if (!legalEntitiesLoaded || legalEntitiesError) return base

      return {
        ...base,
        rows: mapLegalEntitiesToRows(legalEntities),
      }
    }

    return base
  }, [
    activeTab,
    businessUnits,
    businessUnitsError,
    businessUnitsLoaded,
    costCenters,
    costCentersError,
    costCentersLoaded,
    locations,
    locationsError,
    locationsLoaded,
    legalEntities,
    legalEntitiesError,
    legalEntitiesLoaded,
    sites,
    sitesError,
    sitesLoaded,
  ])

  const handleAddClick = () => {
    if (activeTab === 'Business Units') {
      setAddBusinessUnitError('')
      setShowAddBusinessUnitModal(true)
      return
    }

    if (activeTab === 'Cost Centers') {
      setAddCostCenterError('')
      setShowAddCostCenterModal(true)
      return
    }

    if (activeTab === 'Locations') {
      setAddLocationError('')
      setEditingLocation(null)
      setShowAddLocationModal(true)
      return
    }

    if (activeTab === 'Worksites') {
      setAddSiteError('')
      setEditingSite(null)
      setShowAddSiteModal(true)
      return
    }

    if (activeTab === 'Legal Entities') {
      setAddLegalEntityError('')
      setShowAddLegalEntityModal(true)
    }
  }

  const handleCloseModal = () => {
    if (creatingBusinessUnit) return
    setShowAddBusinessUnitModal(false)
    setAddBusinessUnitError('')
  }

  const handleSubmitBusinessUnit = async (
    values: AddBusinessUnitFormValues,
  ) => {
    const code = values.code.trim()
    const name = values.name.trim()

    if (!code) {
      setAddBusinessUnitError('Code is required.')
      return
    }

    if (!name) {
      setAddBusinessUnitError('Name is required.')
      return
    }

    setCreatingBusinessUnit(true)
    setAddBusinessUnitError('')

    try {
      await createBusinessUnit(toCreatePayload(values))
      setShowAddBusinessUnitModal(false)
      await refreshBusinessUnits()
    } catch (error) {
      if (error instanceof BusinessUnitsApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof BusinessUnitsApiError && error.status === 403) {
        setAddBusinessUnitError(
          'You do not have permission to add business units.',
        )
        return
      }

      setAddBusinessUnitError(
        error instanceof Error
          ? error.message
          : 'Unable to create business unit.',
      )
    } finally {
      setCreatingBusinessUnit(false)
    }
  }

  const handleBusinessUnitUpload = useCallback(
    async (rows: Record<string, unknown>[]) => {
      if (rows.length === 0) {
        setBusinessUnitUploadError(
          'No business unit rows were found in the uploaded file.',
        )
        return
      }

      setUploadingBusinessUnits(true)
      setBusinessUnitUploadError('')

      try {
        let createdCount = 0

        for (const row of rows) {
          const code = readUploadString(row, [
            'code',
            'Code',
            'businessUnit',
            'Business Unit',
            'business_unit',
          ])
          const name =
            readUploadString(row, [
              'name',
              'Name',
              'businessUnitName',
              'Business Unit Name',
              'business_unit_name',
            ]) || code

          if (!code || !name) continue

          const companyValue = readUploadString(row, ['company', 'Company'])
          const parsedCompany = companyValue ? Number(companyValue) : NaN

          await createBusinessUnit({
            code,
            name,
            parent:
              readUploadString(row, ['parent', 'Parent', 'parent_code']) ||
              null,
            description:
              readUploadString(row, ['description', 'Description']) ||
              undefined,
            legal_entity_id:
              readUploadString(row, [
                'legalEntityId',
                'legal_entity_id',
                'Legal Entity ID',
              ]) || undefined,
            gl_account_id:
              readUploadString(row, [
                'glAccountId',
                'gl_account_id',
                'GL Account ID',
              ]) || undefined,
            status:
              readUploadString(row, ['status', 'Status']) || 'active',
            company: Number.isFinite(parsedCompany)
              ? parsedCompany
              : undefined,
          })
          createdCount += 1
        }

        if (createdCount === 0) {
          setBusinessUnitUploadError(
            'No valid business unit rows were found. Include at least code and name columns.',
          )
          return
        }

        await refreshBusinessUnits()
        setActiveTab('Business Units')
      } catch (error) {
        if (error instanceof BusinessUnitsApiError && error.status === 401) {
          router.replace('/auth/login?next=/admin/company')
          return
        }

        if (error instanceof BusinessUnitsApiError && error.status === 403) {
          setBusinessUnitUploadError(
            'You do not have permission to add business units.',
          )
          return
        }

        setBusinessUnitUploadError(
          error instanceof Error
            ? error.message
            : 'Unable to upload business units.',
        )
      } finally {
        setUploadingBusinessUnits(false)
      }
    },
    [refreshBusinessUnits, router],
  )

  const handleCloseCostCenterModal = () => {
    if (creatingCostCenter) return
    setShowAddCostCenterModal(false)
    setAddCostCenterError('')
  }

  const handleSubmitCostCenter = async (
    values: AddCostCenterFormValues,
  ) => {
    const code = values.code.trim()
    const name = values.name.trim()
    const ownerEmail = values.ownerEmail.trim()

    if (!code) {
      setAddCostCenterError('Code is required.')
      return
    }

    if (!name) {
      setAddCostCenterError('Name is required.')
      return
    }

    if (!ownerEmail) {
      setAddCostCenterError('Owner email is required.')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(ownerEmail)) {
      setAddCostCenterError('Enter a valid owner email.')
      return
    }

    setCreatingCostCenter(true)
    setAddCostCenterError('')

    try {
      await createCostCenter(toCreateCostCenterPayload(values))
      setShowAddCostCenterModal(false)
      await refreshCostCenters()
    } catch (error) {
      if (error instanceof CostCentersApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof CostCentersApiError && error.status === 403) {
        setAddCostCenterError(
          'You do not have permission to add cost centers.',
        )
        return
      }

      setAddCostCenterError(
        error instanceof Error
          ? error.message
          : 'Unable to create cost center.',
      )
    } finally {
      setCreatingCostCenter(false)
    }
  }

  const handleCloseLocationModal = () => {
    if (creatingLocation) return
    setEditingLocation(null)
    setShowAddLocationModal(false)
    setAddLocationError('')
  }

  const handleEditLocation = (location: LocationRecord) => {
    setAddLocationError('')
    setEditingLocation(location)
    setShowAddLocationModal(true)
  }

  const handleSubmitLocation = async (values: AddLocationFormValues) => {
    const name = values.name.trim()
    const country = values.country.trim()
    const region = values.region.trim()
    const status = values.status.trim().toLowerCase()

    if (!name) {
      setAddLocationError('Location name is required.')
      return
    }
    if (!country) {
      setAddLocationError('Country is required.')
      return
    }
    if (!region) {
      setAddLocationError('Region is required.')
      return
    }
    if (!isLocationStatus(status)) {
      setAddLocationError('Status must be active or inactive.')
      return
    }

    setCreatingLocation(true)
    setAddLocationError('')

    try {
      if (editingLocation) {
        await updateLocation(
          editingLocation.id,
          toLocationUpdatePayload(values),
        )
      } else {
        await createLocation(toLocationPayload(values))
      }

      setEditingLocation(null)
      setShowAddLocationModal(false)
      await refreshLocations()
    } catch (error) {
      if (error instanceof LocationsApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof LocationsApiError && error.status === 403) {
        setAddLocationError(
          editingLocation
            ? 'You do not have permission to edit locations.'
            : 'You do not have permission to add locations.',
        )
        return
      }

      setAddLocationError(
        error instanceof Error
          ? error.message
          : editingLocation
            ? 'Unable to update location.'
            : 'Unable to create location.',
      )
    } finally {
      setCreatingLocation(false)
    }
  }

  const handleDeleteLocation = async (location: LocationRecord) => {
    if (
      !window.confirm(
        `Delete ${location.name}? This location will be removed permanently.`,
      )
    ) {
      return
    }

    setDeletingLocationId(location.id)
    setLocationsError('')

    try {
      await deleteLocation(location.id)
      await refreshLocations()
    } catch (error) {
      if (error instanceof LocationsApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof LocationsApiError && error.status === 403) {
        setLocationsError('You do not have permission to delete locations.')
        return
      }

      setLocationsError(
        error instanceof Error
          ? error.message
          : 'Unable to delete location.',
      )
    } finally {
      setDeletingLocationId(null)
    }
  }

  const handleCloseSiteModal = () => {
    if (creatingSite) return
    setEditingSite(null)
    setShowAddSiteModal(false)
    setAddSiteError('')
  }

  const handleEditSite = (site: SiteRecord) => {
    setAddSiteError('')
    setEditingSite(site)
    setShowAddSiteModal(true)
  }

  const handleSubmitSite = async (values: AddSiteFormValues) => {
    const code = values.code.trim()
    const name = values.name.trim()
    const addressLine1 = values.addressLine1.trim()
    const city = values.city.trim()
    const stateProvince = values.stateProvince.trim()
    const country = values.country.trim().toUpperCase()
    const postalCode = values.postalCode.trim()
    const timezone = values.timezone.trim()
    const currency = values.currency.trim().toUpperCase()
    const latitude = values.latitude.trim()
    const longitude = values.longitude.trim()
    const hoursPerDay = values.hoursPerDay.trim()
    const hoursPerWeek = values.hoursPerWeek.trim()

    if (!code) {
      setAddSiteError('Code is required.')
      return
    }
    if (!name) {
      setAddSiteError('Name is required.')
      return
    }
    if (!addressLine1) {
      setAddSiteError('Address line 1 is required.')
      return
    }
    if (!city) {
      setAddSiteError('City is required.')
      return
    }
    if (!stateProvince) {
      setAddSiteError('State / province is required.')
      return
    }
    if (!country) {
      setAddSiteError('Country is required.')
      return
    }
    if (country.length !== 2) {
      setAddSiteError('Country must be a 2-letter ISO code.')
      return
    }
    if (!postalCode) {
      setAddSiteError('Postal code is required.')
      return
    }
    if (!timezone) {
      setAddSiteError('Timezone is required.')
      return
    }
    if (currency && currency.length !== 3) {
      setAddSiteError('Currency must be a 3-letter ISO code.')
      return
    }

    if (hoursPerDay) {
      const parsed = Number(hoursPerDay)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 24) {
        setAddSiteError('Hours per day must be between 1 and 24.')
        return
      }
    }

    if (hoursPerWeek) {
      const parsed = Number(hoursPerWeek)
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 168) {
        setAddSiteError('Hours per week must be between 1 and 168.')
        return
      }
    }

    if (latitude) {
      const parsed = Number(latitude)
      if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) {
        setAddSiteError('Latitude must be between -90 and 90.')
        return
      }
    }

    if (longitude) {
      const parsed = Number(longitude)
      if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) {
        setAddSiteError('Longitude must be between -180 and 180.')
        return
      }
    }

    setCreatingSite(true)
    setAddSiteError('')

    try {
      if (editingSite) {
        await updateSite(editingSite.id, toCreateSitePayload(values))
      } else {
        await createSite(toCreateSitePayload(values))
      }
      setEditingSite(null)
      setShowAddSiteModal(false)
      await refreshSites()
    } catch (error) {
      if (error instanceof SitesApiError && error.status === 401) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (error instanceof SitesApiError && error.status === 403) {
        setAddSiteError(
          editingSite
            ? 'You do not have permission to edit worksites.'
            : 'You do not have permission to add worksites.',
        )
        return
      }

      setAddSiteError(
        error instanceof Error
          ? error.message
          : editingSite
            ? 'Unable to update worksite.'
            : 'Unable to create worksite.',
      )
    } finally {
      setCreatingSite(false)
    }
  }

  const handleCloseLegalEntityModal = () => {
    if (creatingLegalEntity) return
    setShowAddLegalEntityModal(false)
    setAddLegalEntityError('')
  }

  const handleSubmitLegalEntity = async (
    values: AddLegalEntityFormValues,
  ) => {
    const id = values.id.trim()
    const name = values.name.trim()
    const country = values.country.trim().toUpperCase()
    const currency = values.currency.trim().toUpperCase()
    const billingCountry = values.billingCountry.trim().toUpperCase()

    if (!id) {
      setAddLegalEntityError('Legal entity ID is required.')
      return
    }
    if (!name) {
      setAddLegalEntityError('Name is required.')
      return
    }
    if (!country) {
      setAddLegalEntityError('Country is required.')
      return
    }
    if (country.length !== 2) {
      setAddLegalEntityError('Country must be a 2-letter ISO code.')
      return
    }
    if (!currency) {
      setAddLegalEntityError('Currency is required.')
      return
    }
    if (currency.length !== 3) {
      setAddLegalEntityError('Currency must be a 3-letter ISO code.')
      return
    }
    if (billingCountry && billingCountry.length !== 2) {
      setAddLegalEntityError(
        'Billing country must be a 2-letter ISO code.',
      )
      return
    }

    setCreatingLegalEntity(true)
    setAddLegalEntityError('')

    try {
      await createLegalEntity(toCreateLegalEntityPayload(values))
      setShowAddLegalEntityModal(false)
      await refreshLegalEntities()
    } catch (error) {
      if (
        error instanceof LegalEntitiesApiError &&
        error.status === 401
      ) {
        router.replace('/auth/login?next=/admin/company')
        return
      }

      if (
        error instanceof LegalEntitiesApiError &&
        error.status === 403
      ) {
        setAddLegalEntityError(
          'You do not have permission to add legal entities.',
        )
        return
      }

      setAddLegalEntityError(
        error instanceof Error
          ? error.message
          : 'Unable to create legal entity.',
      )
    } finally {
      setCreatingLegalEntity(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
      <CompanyHeader />
      <AIRulesPanel
        onBusinessUnitUpload={handleBusinessUnitUpload}
        uploadingBusinessUnits={uploadingBusinessUnits}
        businessUnitUploadError={businessUnitUploadError}
      />

      <CompanyTabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'Business Units' && businessUnitsLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading business units...
        </div>
      )}

      {activeTab === 'Business Units' && businessUnitsError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {businessUnitsError}
        </div>
      )}

      {activeTab === 'Cost Centers' && costCentersLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading cost centers...
        </div>
      )}

      {activeTab === 'Cost Centers' && costCentersError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {costCentersError}
        </div>
      )}

      {activeTab === 'Locations' && locationsLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading locations...
        </div>
      )}

      {activeTab === 'Locations' && locationsError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {locationsError}
        </div>
      )}

      {activeTab === 'Worksites' && sitesLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading worksites...
        </div>
      )}

      {activeTab === 'Worksites' && sitesError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {sitesError}
        </div>
      )}

      {activeTab === 'Legal Entities' && legalEntitiesLoading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 shadow-sm">
          Loading legal entities...
        </div>
      )}

      {activeTab === 'Legal Entities' && legalEntitiesError && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-5 py-3 text-sm font-medium text-rose-700">
          {legalEntitiesError}
        </div>
      )}

      <CompanyTable
        config={config}
        onAdd={handleAddClick}
        renderActions={
          activeTab === 'Locations'
            ? (row) =>
                row.locationRecord ? (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleEditLocation(row.locationRecord as LocationRecord)
                      }
                      className="inline-flex items-center justify-center rounded-xl p-2 transition hover:bg-cyan-50"
                      aria-label="Edit location"
                    >
                      <Pencil className="h-4 w-4 text-slate-600" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteLocation(
                          row.locationRecord as LocationRecord,
                        )
                      }
                      disabled={
                        deletingLocationId ===
                        (row.locationRecord as LocationRecord).id
                      }
                      className="inline-flex items-center justify-center rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      aria-label="Delete location"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null
            : activeTab === 'Worksites'
            ? (row) =>
                row.siteRecord ? (
                  <WorksiteActionsDropdown
                    onEdit={() => handleEditSite(row.siteRecord as SiteRecord)}
                  />
                ) : null
            : undefined
        }
      />

      <AddBusinessUnitModal
        isOpen={showAddBusinessUnitModal}
        isSubmitting={creatingBusinessUnit}
        error={addBusinessUnitError}
        parentOptions={businessUnits}
        onClose={handleCloseModal}
        onSubmit={handleSubmitBusinessUnit}
      />

      <AddCostCenterModal
        isOpen={showAddCostCenterModal}
        isSubmitting={creatingCostCenter}
        error={addCostCenterError}
        businessUnits={businessUnits}
        onClose={handleCloseCostCenterModal}
        onSubmit={handleSubmitCostCenter}
      />

      <AddLocationModal
        isOpen={showAddLocationModal}
        isSubmitting={creatingLocation}
        error={addLocationError}
        mode={editingLocation ? 'edit' : 'create'}
        initialValues={
          editingLocation ? toLocationFormValues(editingLocation) : null
        }
        onClose={handleCloseLocationModal}
        onSubmit={handleSubmitLocation}
      />

      <AddSiteModal
        isOpen={showAddSiteModal}
        isSubmitting={creatingSite}
        error={addSiteError}
        legalEntities={legalEntities}
        mode={editingSite ? 'edit' : 'create'}
        initialValues={editingSite ? toSiteFormValues(editingSite) : null}
        onClose={handleCloseSiteModal}
        onSubmit={handleSubmitSite}
      />

      <AddLegalEntityModal
        isOpen={showAddLegalEntityModal}
        isSubmitting={creatingLegalEntity}
        error={addLegalEntityError}
        onClose={handleCloseLegalEntityModal}
        onSubmit={handleSubmitLegalEntity}
      />
      </div>
    </div>
  )
}
