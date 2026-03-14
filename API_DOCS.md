# RedAlert API Documentation

**Base URL:** `https://redalert.orielhaim.com`
**API Key:** `mcpoJDEwCBjfiNjPgSMifQIiErLBeybAEQcBzkZshNpYuqSKeheviXVedazVVxvSobL`

RedAlert is a free service for Israel's real-time emergency alerts - missiles, earthquakes, hostile aircraft intrusions, terrorist infiltrations, and more.

## Authentication

### REST API (Statistics, Shelter, Data)
- REST endpoints appear to be publicly accessible (no auth required for GET endpoints)
- Rate limiting is shared across all endpoints and connections using your public key

### Socket.IO Real-time Client
- Connect via Socket.IO to `https://redalert.orielhaim.com`
- Auth via `auth` object: `{ apiKey: 'your-api-key-here' }`
- Test server available at: `https://redalert.orielhaim.com/test`

**Connection example (JavaScript):**
```javascript
const io = require('socket.io-client');
const socket = io('https://redalert.orielhaim.com', {
  auth: { apiKey: 'your-api-key-here' }
});
```

**Connection example (Python):**
```python
import socketio
sio = socketio.Client()
sio.connect('https://redalert.orielhaim.com', auth={'apiKey': 'your-api-key-here'})
```

### Socket.IO Configuration Parameters
Pass these in the `query` object or as `headers` when connecting:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `timing` | Interval between alerts (min 1s) | "5s", "1m", "30s" |
| `alerts` | Comma-separated alert types | "missiles", "earthQuake,tsunami" |

## Alert Types

### Real Emergency Alerts
- `missiles` - Rocket/Missile Alert
- `earthQuake` - Earthquake
- `tsunami` - Tsunami warnings
- `hostileAircraftIntrusion` - Hostile aircraft
- `hazardousMaterials` - Hazardous materials
- `terroristInfiltration` - Terrorist infiltration
- `newsFlash` - Pre-alert news flash
- `unconventionalWarfare` - Unconventional warfare
- `radiologicalEvent` - Radiological event
- `generalAlert` - General alert

### Drill Alert Types
- `missilesDrill`
- `radiologicalEventDrill`
- `earthQuakeDrill`
- `tsunamiDrill`
- `hostileAircraftIntrusionDrill`
- `hazardousMaterialsDrill`
- `terroristInfiltrationDrill`

## Alert Data Structure

When subscribing to alert type events (e.g., "missiles", "earthQuake"), you receive a single alert object:

```json
{
  "type": "missiles",
  "title": "Rocket/Missile Alert",
  "cities": ["City1", "City2"],
  "instructions": "Official instructions for the population"
}
```

Fields:
- `type` - Alert category identifier
- `title` - Official alert title
- `cities` - Array of city names currently under this alert type
- `instructions` - Official instructions for the population (from "desc" field)

---

## REST API Endpoints

### 1. Active Alerts API
**`GET /api/active`**

Real-time snapshot of cities currently under alert, grouped by alert type. No query parameters.

**Response:**
```json
{
  "{alertType}": ["city1", "city2"]
}
```
- Keys are alert type strings, values are arrays of city names currently under that alert type.

---

### 2. Statistics API

#### 2.1 Summary Statistics
**`GET /api/stats/summary`**

High-level overview of the alert system. By default returns core counts and unique city/zone numbers. Use the `include` parameter to opt-in to additional sections.

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `startDate` | ISO 8601 | Filter data from this date onwards | all time | No |
| `endDate` | ISO 8601 | Filter data until this date | now | No |
| `origin` | string | Filter by alert origin(s), comma-separated (e.g. gaza,lebanon) | all origins | No |
| `include` | string | Comma-separated optional sections: topCities, topZones, topOrigins, timeline, peak | (none) | No |
| `topLimit` | integer | Number of items in topCities / topZones (1–50) | 5 | No |
| `timelineGroup` | enum | Grouping interval for timeline | hour | No |

**Response Fields (always included):**

| Path | Type | Description |
|------|------|-------------|
| `totals.range` | number | Total alerts in the requested date range (or all time) |
| `totals.last24h` | number | Alerts in the last 24 hours |
| `totals.last7d` | number | Alerts in the last 7 days |
| `totals.last30d` | number | Alerts in the last 30 days |
| `uniqueCities` | number | Number of distinct cities with alerts in range |
| `uniqueZones` | number | Number of distinct zones with alerts in range |
| `uniqueOrigins` | number | Number of distinct alert origins in range |

**Optional Response Fields (via `include`):**

| Path | Type | Description | Include |
|------|------|-------------|---------|
| `topCities[].city` | string | City name | topCities |
| `topCities[].zone` | string | Zone the city belongs to | topCities |
| `topCities[].count` | number | Alert count for this city | topCities |
| `topZones[].zone` | string | Zone name | topZones |
| `topZones[].count` | number | Alert count for this zone | topZones |
| `topOrigins[].origin` | string | Origin name (e.g. gaza, lebanon) | topOrigins |
| `topOrigins[].count` | number | Alert count from this origin | topOrigins |
| `timeline[].period` | string | Time bucket label (format depends on timelineGroup) | timeline |
| `timeline[].count` | number | Alert count in this period | timeline |
| `peak.period` | string | The peak hour (ISO format) | peak |
| `peak.count` | number | Alert count in peak hour | peak |

**Example URLs:**
- Basic: `GET /api/stats/summary`
- Dashboard: `GET /api/stats/summary?include=topCities,topZones,timeline,peak&topLimit=5&timelineGroup=hour`
- Chart Data: `GET /api/stats/summary?include=timeline&timelineGroup=day&startDate=2023-10-07T00:00:00Z`

#### 2.2 Cities Statistics
**`GET /api/stats/cities`**

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | No |
| `endDate` | ISO 8601 | Filter alerts until this date | now | No |
| `limit` | integer | Number of cities to return | 5 | No |
| `offset` | integer | Number of results to skip for pagination | 0 | No |
| `origin` | string | Filter by alert origin(s), comma-separated | all origins | No |
| `search` | string | Search cities by name (partial match) | - | No |
| `include` | string | Comma-separated: translations, coords | (none) | No |

**Response Fields (always included):**

| Path | Type | Description |
|------|------|-------------|
| `data[].city` | string | City name in Hebrew |
| `data[].cityZone` | string | Zone/region the city belongs to |
| `data[].count` | number | Total number of alerts for this city |

**Optional Response Fields:**

| Path | Type | Description | Include |
|------|------|-------------|---------|
| `data[].translations` | object | Translated names in en, ru, ar | translations |
| `data[].lat` | number | Latitude | coords |
| `data[].lng` | number | Longitude | coords |

**Pagination:**
- `pagination.total`, `pagination.limit`, `pagination.offset`, `pagination.hasMore`

#### 2.3 History
**`GET /api/stats/history`**

Retrieve detailed historical records of alerts with full city data.

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | No |
| `endDate` | ISO 8601 | Filter alerts until this date | now | No |
| `limit` | integer | Number of alerts to return (1–100) | 20 | No |
| `offset` | integer | Number of results to skip for pagination | 0 | No |
| `cityId` | integer | Filter by city ID (exact match) | - | No |
| `cityName` | string | Filter by city name in Hebrew (exact match) | - | No |
| `search` | string | Search by city name (partial match, 1–100 chars) | - | No |
| `category` | string | Filter by alert type (e.g. missiles, drones, earthquakes) | all | No |
| `origin` | string | Filter by alert origin(s), comma-separated | all origins | No |
| `sort` | enum | Sort results by: timestamp, type, or origin | timestamp | No |
| `order` | enum | Sort direction: asc or desc | desc | No |
| `include` | string | Comma-separated: translations, coords, polygons | (none) | No |

**Response Fields (always included):**

| Path | Type | Description |
|------|------|-------------|
| `data[].id` | number | Unique alert ID |
| `data[].timestamp` | string | ISO 8601 timestamp of the alert |
| `data[].type` | string | Alert category |
| `data[].origin` | string | Alert origin / threat source (e.g. gaza, lebanon) |
| `data[].cities[].id` | number | City ID |
| `data[].cities[].name` | string | City name in Hebrew |

**Optional Response Fields:**

| Path | Type | Description | Include |
|------|------|-------------|---------|
| `data[].cities[].translations` | object | Translated name in en, ru, ar | translations |
| `data[].cities[].lat` | number | Latitude coordinate | coords |
| `data[].cities[].lng` | number | Longitude coordinate | coords |
| `data[].cities[].polygons` | object | GeoJSON polygon for city boundary | polygons |

**Pagination:** `pagination.total`, `pagination.limit`, `pagination.offset`, `pagination.hasMore`

#### 2.4 Distribution
**`GET /api/stats/distribution`**

Alert distribution by category or origin.

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `startDate` | ISO 8601 | Filter alerts from this date onwards | all time | No |
| `endDate` | ISO 8601 | Filter alerts until this date | now | No |
| `origin` | string | Filter by alert origin(s), comma-separated | all origins | No |
| `groupBy` | enum | Group results by: category or origin | category | No |
| `category` | string | Filter by specific alert type (exact match) | - | No |
| `limit` | integer | Number of categories to return (1–100) | 50 | No |
| `offset` | integer | Number of results to skip | 0 | No |
| `sort` | enum | Sort by: count or category | count | No |
| `order` | enum | Sort direction: asc or desc | desc | No |

**Response Fields:**

| Path | Type | Description |
|------|------|-------------|
| `data[].category` | string | Category name or origin name (depends on groupBy) |
| `data[].count` | number | Total number of alerts for this group |
| `totalAlerts` | number | Sum of all counts - useful for calculating percentages |
| `pagination.total` | number | Total matching groups |
| `pagination.limit` | number | Requested limit |
| `pagination.offset` | number | Requested offset |
| `pagination.hasMore` | boolean | Whether more results are available |

---

### 3. Shelter API

#### 3.1 Shelter Search
**`GET /api/shelter/search`**

Find nearby shelters using geospatial search (KDBush spatial index).

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `lat` | number | Latitude of search center | - | Yes |
| `lon` | number | Longitude of search center | - | Yes |
| `limit` | integer | Number of shelters to return | 10 | No |
| `radius` | number | Search radius in kilometers | unlimited | No |
| `wheelchairOnly` | boolean | Filter wheelchair accessible shelters only | false | No |
| `shelterType` | string | Filter by shelter type (e.g. "public", "private") | - | No |
| `city` | string | Filter by city name | - | No |

**Response Fields:**

| Path | Type | Description |
|------|------|-------------|
| `success` | boolean | Whether the request was successful |
| `count` | number | Number of results returned |
| `results[].id` | number | Unique shelter identifier |
| `results[].address` | string | Street address |
| `results[].city` | string | City name |
| `results[].building_name` | string | Building name or description |
| `results[].lat` | number | Latitude |
| `results[].lon` | number | Longitude |
| `results[].distance_m` | number | Distance from search center in meters |
| `results[].distance_km` | number | Distance in kilometers |
| `results[].capacity` | number | Maximum capacity |
| `results[].wheelchair_accessible` | boolean | Wheelchair accessible |
| `results[].has_stairs` | boolean | Whether there are stairs |
| `results[].shelter_type` | string | Shelter type (e.g. public, private) |
| `results[].shelter_type_he` | string | Shelter type in Hebrew |
| `results[].area_sqm` | number | Shelter area in square meters |
| `results[].is_official` | boolean | Whether this is an official shelter |
| `results[].notes` | string | Additional notes |

---

### 4. Data API

#### 4.1 Cities Catalog
**`GET /api/data/cities`**

Raw location records (without alert statistics) - ideal for building dropdowns, lookup tables, and map layers.

**Query Parameters:**

| Name | Type | Description | Default | Required |
|------|------|-------------|---------|----------|
| `search` | string | Search by city name (partial match, 1-100 chars) | - | No |
| `zone` | string | Filter by zone/region name (exact match) | - | No |
| `limit` | integer | Number of cities to return (1-500) | 100 | No |
| `offset` | integer | Number of results to skip | 0 | No |
| `include` | string | Comma-separated: translations, coords, countdown | (none) | No |

**Response Fields (always included):**

| Path | Type | Description |
|------|------|-------------|
| `data[].id` | number | Internal location identifier |
| `data[].name` | string | City name in Hebrew |
| `data[].zone` | string \| null | Zone/region name |

**Optional Response Fields:**

| Path | Type | Description | Include |
|------|------|-------------|---------|
| `data[].translations` | object | Translated name & zone (en, ru, ar) | translations |
| `data[].lat` | number \| null | Latitude coordinate | coords |
| `data[].lng` | number \| null | Longitude coordinate | coords |
| `data[].countdown` | number \| null | Configured countdown time (seconds) | countdown |

**Pagination:** `pagination.total`, `pagination.limit`, `pagination.offset`, `pagination.hasMore`

---

### 5. Health
**`GET /api/health`**

Health check endpoint.

---

### 6. Access Request
**`POST /api/access-request`**

Request API access (details not documented in JS bundle).
