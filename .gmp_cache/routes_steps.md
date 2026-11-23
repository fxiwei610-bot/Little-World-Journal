# Return Directions and Maneuver Steps Between Coordinates

This capability sub-workflow demonstrates how to calculate routes between two or
more sets of latitude and longitude coordinates using the Routes API
(`computeRoutes` endpoint) and retrieve a series of maneuver descriptions for
the steps along the route.

## Prerequisites

-   A Google Cloud project with the **Routes API** enabled.
-   A valid Google Maps Platform **API Key** with permissions to call the Routes
    API.

--------------------------------------------------------------------------------

## Workflow Steps

### 1. Endpoint and Method

Send an HTTP `POST` request to the `computeRoutes` REST endpoint (or invoke the
`ComputeRoutes` gRPC method):

```http
POST https://routes.googleapis.com/directions/v2:computeRoutes
```

### 2. Required Request Headers

Configure the following HTTP headers on your request:

-   `Content-Type`: `application/json`
-   `X-Goog-Api-Key`: `YOUR_API_KEY`
-   `X-Goog-Maps-Solution-ID`: `gmp_git_agentskills_v1` (Required attribution
    header for standard REST calls)
-   `X-Goog-FieldMask`: Specify the response fields to return. To get
    step-by-step maneuver descriptions along with overall route metrics, include
    `routes.legs.steps.navigationInstruction` in your field mask:

    ```text
    routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration
    ```

### 3. Construct the Request Body

Define the `origin` and `destination` (and optionally `intermediates` for more
than two coordinates) using `location.latLng` objects containing `latitude` and
`longitude` values. You can also specify routing options such as `travelMode`,
`routingPreference`, `routeModifiers`, `languageCode`, and `units`.

--------------------------------------------------------------------------------

## Code Examples

### REST (cURL)

The following example requests a traffic-aware driving route between two
latitude/longitude coordinates and returns overall metrics along with
step-by-step maneuver instructions.

```bash
curl -X POST -d '{
  "origin": {
    "location": {
      "latLng": {
        "latitude": 37.419734,
        "longitude": -122.0827784
      }
    }
  },
  "destination": {
    "location": {
      "latLng": {
        "latitude": 37.417670,
        "longitude": -122.079595
      }
    }
  },
  "travelMode": "DRIVE",
  "routingPreference": "TRAFFIC_AWARE",
  "computeAlternativeRoutes": false,
  "routeModifiers": {
    "avoidTolls": false,
    "avoidHighways": false,
    "avoidFerries": false
  },
  "languageCode": "en-US",
  "units": "METRIC"
}' \
-H 'Content-Type: application/json' \
-H 'X-Goog-Api-Key: YOUR_API_KEY' \
-H 'X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1' \
-H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction' \
'https://routes.googleapis.com/directions/v2:computeRoutes'
```

#### Example Response

```json
{
  "routes": [
    {
      "legs": [
        {
          "steps": [
            {
              "navigationInstruction": {
                "maneuver": "DEPART",
                "instructions": "Head south on Charleston Rd toward Amphitheatre Pkwy"
              }
            },
            {
              "navigationInstruction": {
                "maneuver": "TURN_LEFT",
                "instructions": "Turn left onto Amphitheatre Pkwy"
              }
            }
          ]
        }
      ],
      "distanceMeters": 772,
      "duration": "165s",
      "polyline": {
        "encodedPolyline": "ipkcFfichVnP@j@BLoFVwM{E?"
      }
    }
  ]
}
```

--------------------------------------------------------------------------------

### Node.js (Fetch / REST)

```javascript
async function computeRouteSteps() {
  const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY';

  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: 37.419734,
          longitude: -122.0827784
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: 37.417670,
          longitude: -122.079595
        }
      }
    },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false
    },
    languageCode: 'en-US',
    units: 'METRIC'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-Maps-Solution-ID': 'gmp_git_agentskills_v1',
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

computeRouteSteps().catch(console.error);
```

--------------------------------------------------------------------------------

### Go (gRPC)

```go
package main

import (
    "context"
    "crypto/tls"
    "fmt"
    "log"
    "time"

    routespb "google.golang.org/genproto/googleapis/maps/routing/v2"
    "google.golang.org/genproto/googleapis/type/latlng"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials"
    "google.golang.org/grpc/metadata"
)

const (
    // Specify the exact fields needed in production rather than "*"
    fieldMask  = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction"
    apiKey     = "INSERT_API_KEY_HERE"
    serverAddr = "routes.googleapis.com:443"
)

func main() {
    config := tls.Config{}
    conn, err := grpc.Dial(serverAddr,
        grpc.WithTransportCredentials(credentials.NewTLS(&config)))
    if err != nil {
        log.Fatalf("Failed to connect: %v", err)
    }
    defer conn.Close()

    client := routespb.NewRoutesClient(conn)
    ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
    ctx = metadata.AppendToOutgoingContext(ctx, "X-Goog-Api-Key", apiKey)
    ctx = metadata.AppendToOutgoingContext(ctx, "X-Goog-Fieldmask", fieldMask)
    ctx = metadata.AppendToOutgoingContext(ctx, "X-Goog-Maps-Solution-ID", "gmp_git_agentskills_v1")
    defer cancel()

    // Create the origin using a latitude and longitude
    origin := &routespb.Waypoint{
        LocationType: &routespb.Waypoint_Location{
            Location: &routespb.Location{
                LatLng: &latlng.LatLng{
                    Latitude:  37.419734,
                    Longitude: -122.0827784,
                },
            },
        },
    }

    // Create the destination using a latitude and longitude
    destination := &routespb.Waypoint{
        LocationType: &routespb.Waypoint_Location{
            Location: &routespb.Location{
                LatLng: &latlng.LatLng{
                    Latitude:  37.417670,
                    Longitude: -122.079595,
                },
            },
        },
    }

    req := &routespb.ComputeRoutesRequest{
        Origin:                   origin,
        Destination:              destination,
        TravelMode:               routespb.RouteTravelMode_DRIVE,
        RoutingPreference:        routespb.RoutingPreference_TRAFFIC_AWARE,
        ComputeAlternativeRoutes: false,
        Units:                    routespb.Units_METRIC,
        RouteModifiers: &routespb.RouteModifiers{
            AvoidTolls:    false,
            AvoidHighways: false,
            AvoidFerries:  false,
        },
        PolylineQuality: routespb.PolylineQuality_OVERVIEW,
    }

    // Execute RPC
    resp, err := client.ComputeRoutes(ctx, req)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Printf("Response: %v\n", resp)
}
```

--------------------------------------------------------------------------------

### Node.js (gRPC)

```javascript
const protoPath = "YOUR_PROTO_PATH";
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const packageDefinition = protoLoader.loadSync(protoPath, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor =
  grpc.loadPackageDefinition(packageDefinition).google.maps.routing.v2;

const metadata = new grpc.Metadata();
const host = "routes.googleapis.com:443";
const apiKey = "YOUR_API_KEY";
const fieldMask = "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction";

const ComputeRoutesRequest = {
  origin: {
    location: {
      lat_lng: {
        latitude: -37.816,
        longitude: 144.964,
      },
    },
  },
  destination: {
    location: {
      lat_lng: {
        latitude: -37.815,
        longitude: 144.966,
      },
    },
  },
  routing_preference: "TRAFFIC_AWARE",
  travel_mode: "DRIVE",
};

const ssl_creds = grpc.credentials.createSsl();
const call_creds = grpc.credentials.createFromMetadataGenerator(
  function (args, callback) {
    metadata.set("X-Goog-Api-Key", apiKey);
    metadata.set("X-Goog-Fieldmask", fieldMask);
    metadata.set("X-Goog-Maps-Solution-ID", "gmp_git_agentskills_v1");
    metadata.set("Content-Type", "application/json");
    callback(null, metadata);
  }
);

const credentials = grpc.credentials.combineChannelCredentials(
  ssl_creds,
  call_creds
);

const client = new protoDescriptor.Routes(host, credentials);
client.ComputeRoutes(ComputeRoutesRequest, (error, response) => {
  if (error) {
    console.error(error);
    return;
  } else if (response) {
    console.log(JSON.stringify(response, null, 2));
  }
});
```

--------------------------------------------------------------------------------

## Multi-Waypoint Routes (More than Two Coordinates)

To compute directions across more than two sets of coordinates, add an
`intermediates` array of waypoints to the request body between `origin` and
`destination`. Each pair of adjacent waypoints forms a separate `RouteLeg` in
the `routes.legs` response array, with its own `steps` and
`navigationInstruction` objects:

```json
{
  "origin": {
    "location": { "latLng": { "latitude": 37.419734, "longitude": -122.0827784 } }
  },
  "intermediates": [
    {
      "location": { "latLng": { "latitude": 37.418500, "longitude": -122.081000 } }
    }
  ],
  "destination": {
    "location": { "latLng": { "latitude": 37.417670, "longitude": -122.079595 } }
  },
  "travelMode": "DRIVE"
}
```
