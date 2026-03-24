import type React from 'react'
import Home from '../../app/page'
import { auth } from '../../auth'
import { getItineraryStore } from '../../app/lib/itinerary-store/store'
import logger from '../../app/lib/logger'

jest.mock('../../auth', () => ({
  auth: jest.fn(),
}))

jest.mock('../../app/lib/itinerary-store/store', () => ({
  getItineraryStore: jest.fn(),
}))

jest.mock('../../app/lib/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}))

jest.mock('../../components/TravelPlan', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => ({
    __mockTravelPlan: true,
    props,
  }),
}))

describe('Home page bootstrap', () => {
  const authMock = auth as jest.MockedFunction<typeof auth>
  const getItineraryStoreMock = getItineraryStore as jest.MockedFunction<typeof getItineraryStore>
  const loggerErrorMock = logger.error as jest.MockedFunction<typeof logger.error>

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('keeps rendering when itinerary summaries bootstrap fails', async () => {
    authMock.mockResolvedValue({ user: { email: 'test@gmail.com' } } as Awaited<ReturnType<typeof auth>>)

    const store = {
      listByOwner: jest.fn().mockRejectedValue(new Error('index read failed')),
      getById: jest.fn(),
    }
    getItineraryStoreMock.mockReturnValue(store as ReturnType<typeof getItineraryStore>)

    const element = await Home({
      searchParams: Promise.resolve({ tab: 'itinerary', itineraryId: 'iti-123' }),
    })

    const travelPlanElement = (element as React.ReactElement).props.children
    expect(travelPlanElement.props.initialItineraryId).toBe('iti-123')
    expect(travelPlanElement.props.initialItineraryWorkspace).toBeNull()
    expect(travelPlanElement.props.initialItinerarySummaries).toEqual([])
    expect(loggerErrorMock).toHaveBeenCalledTimes(1)
  })
})
