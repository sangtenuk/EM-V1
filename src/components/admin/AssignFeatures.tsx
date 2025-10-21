import { useState, useEffect } from 'react'
import { 
  Settings, 
  Users, 
  QrCode, 
  Vote, 
  MessageSquare, 
  HelpCircle, 
  Gift, 
  Image,
  Save,
  RotateCcw,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useHybridDB } from '../../lib/hybridDB'
import toast from 'react-hot-toast'

interface Company {
  id: string
  name: string
  features_enabled?: {
    registration: boolean
    checkin: boolean
    voting: boolean
    welcoming: boolean
    quiz: boolean
    lucky_draw: boolean
    gallery: boolean
  }
  created_at?: string
  person_in_charge?: string
  contact_number?: string
  email?: string
  logo?: string
}

interface Feature {
  key: string
  name: string
  description: string
  icon: any
  color: string
}

const features: Feature[] = [
  {
    key: 'registration',
    name: 'Registration & Attendees',
    description: 'Allow company to manage event registration and attendee data',
    icon: Users,
    color: 'bg-blue-500'
  },
  {
    key: 'checkin',
    name: 'Check-in System',
    description: 'Enable QR code scanning and check-in functionality',
    icon: QrCode,
    color: 'bg-green-500'
  },
  {
    key: 'voting',
    name: 'Voting & Monitoring',
    description: 'Create voting sessions and monitor real-time results',
    icon: Vote,
    color: 'bg-purple-500'
  },
  {
    key: 'welcoming',
    name: 'Welcoming & Monitoring',
    description: 'Welcome screen and attendee monitoring system',
    icon: MessageSquare,
    color: 'bg-orange-500'
  },
  {
    key: 'quiz',
    name: 'Quiz & Monitoring',
    description: 'Interactive quiz system with real-time monitoring',
    icon: HelpCircle,
    color: 'bg-indigo-500'
  },
  {
    key: 'lucky_draw',
    name: 'Lucky Draw & Monitoring',
    description: 'Lucky draw system with winner management',
    icon: Gift,
    color: 'bg-pink-500'
  },
  {
    key: 'gallery',
    name: 'Gallery',
    description: 'Photo gallery and upload management',
    icon: Image,
    color: 'bg-teal-500'
  }
]

export default function AssignFeatures() {
  const { getCompanies, updateCompany } = useHybridDB()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [originalFeatures, setOriginalFeatures] = useState<any>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      const companiesData = await getCompanies()
      setCompanies(companiesData)
    } catch (error: any) {
      toast.error('Error fetching companies: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCompanySelect = (company: Company) => {
    setSelectedCompany(company)
    setOriginalFeatures(JSON.parse(JSON.stringify(company.features_enabled || {})))
  }

  const toggleFeature = (featureKey: string) => {
    if (!selectedCompany) return

    const currentFeatures = selectedCompany.features_enabled || {
      registration: true,
      checkin: true,
      voting: true,
      welcoming: true,
      quiz: true,
      lucky_draw: true,
      gallery: true
    }

    const updatedFeatures = {
      ...currentFeatures,
      [featureKey]: !currentFeatures[featureKey as keyof typeof currentFeatures]
    }

    setSelectedCompany({
      ...selectedCompany,
      features_enabled: updatedFeatures
    })
  }

  const saveFeatures = async () => {
    if (!selectedCompany) return

    setSaving(true)
    try {
      await updateCompany(selectedCompany.id, {
        features_enabled: selectedCompany.features_enabled
      })

      // Update the companies list
      setCompanies(prev => 
        prev.map(company => 
          company.id === selectedCompany.id 
            ? { ...company, features_enabled: selectedCompany.features_enabled }
            : company
        )
      )

      toast.success('Features updated successfully!')
      setOriginalFeatures(JSON.parse(JSON.stringify(selectedCompany.features_enabled)))
    } catch (error: any) {
      toast.error('Error updating features: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const resetFeatures = () => {
    if (!selectedCompany || !originalFeatures) return
    setSelectedCompany({
      ...selectedCompany,
      features_enabled: originalFeatures
    })
  }

  const hasChanges = () => {
    if (!selectedCompany || !originalFeatures) return false
    return JSON.stringify(selectedCompany.features_enabled) !== JSON.stringify(originalFeatures)
  }

  const getEnabledFeaturesCount = (company: Company) => {
    const features = company.features_enabled || {}
    return Object.values(features).filter(Boolean).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Assign Features
          </h1>
          <p className="text-gray-600 mt-2">
            Configure which features are available for each company based on their package
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Company List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Companies</h2>
              <div className="space-y-3">
                {companies.map((company) => (
                  <button
                    key={company.id}
                    onClick={() => handleCompanySelect(company)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                      selectedCompany?.id === company.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{company.name}</h3>
                        <p className="text-sm text-gray-500">
                          {getEnabledFeaturesCount(company)} features enabled
                        </p>
                      </div>
                      {selectedCompany?.id === company.id && (
                        <CheckCircle className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Feature Assignment */}
          <div className="lg:col-span-2">
            {selectedCompany ? (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      Configure Features for {selectedCompany.name}
                    </h2>
                    <p className="text-gray-500 text-sm">
                      Toggle features on/off based on the company's package
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    {hasChanges() && (
                      <>
                        <button
                          onClick={resetFeatures}
                          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors font-medium flex items-center"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Reset
                        </button>
                        <button
                          onClick={saveFeatures}
                          disabled={saving}
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 font-medium flex items-center disabled:opacity-50"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Save Changes
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {features.map((feature) => {
                    const isEnabled = selectedCompany.features_enabled?.[feature.key as keyof typeof selectedCompany.features_enabled] || false
                    const IconComponent = feature.icon

                    return (
                      <div
                        key={feature.key}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                          isEnabled
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                        onClick={() => toggleFeature(feature.key)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${feature.color} text-white`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-gray-800">{feature.name}</h3>
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isEnabled 
                                  ? 'border-green-500 bg-green-500' 
                                  : 'border-gray-300'
                              }`}>
                                {isEnabled && <CheckCircle className="h-4 w-4 text-white" />}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{feature.description}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <Settings className="h-5 w-5" />
                    <span className="font-medium">Feature Summary</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    {getEnabledFeaturesCount(selectedCompany)} out of {features.length} features are enabled for this company.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">Select a Company</h3>
                  <p>Choose a company from the list to configure their features</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 