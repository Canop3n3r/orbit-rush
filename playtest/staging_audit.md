# Staging audit (f5.1g)

Generated Tue Oct 20 2026 14:34 CT by the headless staging harness (browser: every picker rocket launched, the 3D model's userData.stages checked at every physics stage; node: every stack flown on AUTO).

**After fix: 101/102 pass. Before (f5.1f): 5/102.**

## Causes before the fix

| cause | rockets |
|---|---|
| model has N core stages, stack drops N | 84 |
| model stages never driven (flight knew only booster/upper) | 83 |
| model boosters, stack has none | 44 |
| stack boosters, model has none | 3 |
| stack drops N core stages, model has N | 2 |

## Remaining failures

| cause | rockets |
|---|---|
| model has N core stages, stack drops N | 1 |

## Physics stacks on AUTO (node)

| stack | stages | boosters | stage events | orbit | fairing | notes |
|---|---|---|---|---|---|---|
| pip | 1 | 0 |  | no | - | end: hit the ground at 45 m/s, 80° from upright |
| needle | 2 | 0 | 1@56 km | yes | dropped |  |
| swift | 2 | 0 | 1@48 km | yes | dropped |  |
| heron | 3 | 0 | 1@58 km | yes | dropped |  |
| atlas | 3 | 1 | 1@20 km, 2@108 km | yes | dropped |  |
| selene | 3 | 0 | 1@101 km | yes | dropped |  |
| ares | 4 | 0 | 1@106 km | yes | dropped |  |
| colossus (super-heavy) | 2 | 0 | 1@50 km | yes | dropped |  |
| hopper | 1 | 0 |  | no | - | end: hit the ground at 229 m/s, 168° from upright |

## Every rocket

| rocket | model | flies on | stages | after | before |
|---|---|---|---|---|---|
| Pip | (part stack) | Sounding rocket · touch space | 1 | pass | pass |
| Sparrow-1 Smallsat Launcher | sparrow-1 | Slim two-stage orbiter | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron-9 | heron-9 | Reusable booster · lands itself | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron-9 Crew | heron-9-crew | Crew capsule · orbit and splash down | 3 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron Heavy | heron-heavy | Heavy lifter · 2 side boosters | 3 | pass | FAIL: model boosters, stack has none; model has 2 core stages, stack drops 1 |
| selene | selene | Three-stage Moon rocket + lander | 3 | pass | pass |
| ares | ares | Mars lander stack (also Venus) | 4 | pass | pass |
| Colossus (Mk III) | colossus-v3 | Super-heavy · 5-engine cluster | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Grasshopper | (part stack) | Test hopper · hop and land on the pad | 1 | pass | pass |
| Sparrow-1 Smallsat Launcher | sparrow-1 | Sparrow-1 Smallsat Launcher | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron-9 | heron-9 | Heron-9 | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron-9 (Mk II) | heron-9-v11 | Heron-9 | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron-9 Crew | heron-9-crew | Heron-9 | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Heron Heavy | heron-heavy | Heron Heavy | 3 | pass | FAIL: model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Colossus (Mk III) | colossus-v3 | Colossus (Mk III) | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Colossus (Mk IV) | colossus-v4 | Colossus (Mk III) | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Space Truck | space-truck | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Saturnine V | saturnine-v | Heron-9 Crew | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); stack boosters, model has none; model has 3 core stages, stack drops 1 |
| Redrock | redrock | Pip | 1 | pass | pass |
| Redrock Crew | redrock-crew | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper) |
| Junebug 1 | junebug-1 | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper) |
| Saturnine 1 | saturnine-1 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Saturnine 1b | saturnine-1b | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Vantguard | vantguard | selene | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| Europia | europia | selene | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| Vegara | vegara | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Vegara C | vegara-c | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Arion 5 | arion-5 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Arion 62 | arion-62 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Arion 64 | arion-64 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Dark Dart | dark-dart | Sparrow-1 Smallsat Launcher | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Baltic Hammer | baltic-hammer | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper); stack drops 1 core stages, model has 0 |
| Baltic Hammer Tandem | baltic-hammer-tandem | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper) |
| New Glendale | new-glendale | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); stack boosters, model has none; model has 2 core stages, stack drops 1 |
| Electrino | electrino | Sparrow-1 Smallsat Launcher | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Electrino Recovery | electrino-recovery | Sparrow-1 Smallsat Launcher | 2 | pass | FAIL: model has 2 core stages, stack drops 1 |
| Titanus 4 | titanus-4 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean Crew | atlantean-crew | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper) |
| Atlantean Upper | atlantean-upper | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Deltoid 2 Heavy9 | deltoid-2-heavy9 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Deltoid 2 Light3 | deltoid-2-light3 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Diamantine A | diamantine-a | selene | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| Diamantine B | diamantine-b | selene | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| New Shepherd-ish | new-shepherdish | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper) |
| Featherwing I | featherwing-1 | Pip | 1 | pass | FAIL: model stages never driven (flight knew only booster/upper); stack drops 1 core stages, model has 0 |
| Polar Slinger | polar-slinger | Booster 2-stage | 4 | FAIL: model has 3 core stages, stack drops 2 | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 4 core stages, stack drops 1 |
| Monsoon Heavy | monsoon-heavy | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Jade Lantern 5 | jade-lantern-5 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Jade Lantern 5B | jade-lantern-5b | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Jade Lantern 2F Crew | jade-lantern-2f | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Jade Lantern 3B | jade-lantern-3b | Booster 2-stage | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 3 core stages, stack drops 1 |
| Tsubame | tsubame | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Tsubame 2024 | tsubame-2024 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Tsurugi 22 | tsurugi-22 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Tsurugi 24 | tsurugi-24 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Tsurugi 30 | tsurugi-30 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Rodnik | rodnik | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Rodnik 2 | rodnik-2 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Lastochka | lastochka | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Pervy | pervy | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Mogutny Glider | mogutny-glider | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Mogutny | mogutny | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Moonhammer | moonhammer | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); stack boosters, model has none; model has 4 core stages, stack drops 1 |
| Gorynych M | gorynych-m | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Gorynych K | gorynych-k | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Taiga 1 | taiga-1 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Taiga A5 | taiga-a5 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Scoutling | scoutling | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Scoutling X-1 | scoutling-x1 | ares | 4 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 4 core stages, stack drops 1 |
| Titanus 2 | titanus-2 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Titanus 2 Icbm | titanus-2-icbm | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Pegacorn | pegacorn | selene | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| Antarion | antarion | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Space Truck | space-truck | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none |
| Super Lift Crew | super-lift-crew | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Super Lift Cargo | super-lift-cargo | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Super Lift 1b Crew | super-lift-1b-crew | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Super Lift 1b Cargo | super-lift-1b-cargo | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Steppe Arrow 2 | steppe-arrow-2 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Steppe Arrow 3 | steppe-arrow-3 | Heron-9 Crew | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 3 core stages, stack drops 1 |
| Atlantean V 401 L | atlantean-v-401-l | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Atlantean V 501 M | atlantean-v-501-m | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Atlantean V 551 L | atlantean-v-551-l | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 541 M | atlantean-v-541-m | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 401 | atlantean-v-401 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Atlantean V 411 | atlantean-v-411 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 421 | atlantean-v-421 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 431 | atlantean-v-431 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 501 | atlantean-v-501 | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Atlantean V 511 | atlantean-v-511 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 521 | atlantean-v-521 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 531 | atlantean-v-531 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 541 | atlantean-v-541 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Atlantean V 551 | atlantean-v-551 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Deltoid 4 M | deltoid-4-m | Heron-9 | 2 | pass | FAIL: model stages never driven (flight knew only booster/upper); model has 2 core stages, stack drops 1 |
| Deltoid 4 M42 | deltoid-4-m42 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Deltoid 4 M52 | deltoid-4-m52 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Deltoid 4 M54 | deltoid-4-m54 | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Deltoid 4 Heavy | deltoid-4-heavy | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Vulcanis 2s | vulcanis-2s | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Vulcanis 4l | vulcanis-4l | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
| Vulcanis 6l | vulcanis-6l | Heron Heavy | 3 | pass | FAIL: model stages never driven (flight knew only booster/upper); model boosters, stack has none; model has 2 core stages, stack drops 1 |
