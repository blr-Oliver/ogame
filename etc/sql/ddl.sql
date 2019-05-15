alter table space_body
  drop foreign key fk_planet_resource,
  drop foreign key fk_planet_fleet,
  drop foreign key fk_planet_defense,
  drop foreign key fk_planet_building;

drop table fleet_info;
drop table defense_info;
drop table building_info;

alter table player
  drop foreign key fk_player_main,
  drop foreign key fk_player_research;

drop table research_info;
drop table space_body;
drop table player;
drop table alliance;

CREATE TABLE alliance (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    short_name VARCHAR(20) NOT NULL UNIQUE,
    site VARCHAR(500)
);

CREATE TABLE player (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    main_planet INT NOT NULL,
    alliance_id INT,
    research_info INT,
    FOREIGN KEY (alliance_id)
        REFERENCES alliance (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE space_body (
    id INT NOT NULL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    player_id INT,
    sattelite_id INT,
    galaxy TINYINT NOT NULL,
    system SMALLINT NOT NULL,
    position TINYINT NOT NULL,
    type TINYINT NOT NULL DEFAULT 1,
    size SMALLINT,
    fields SMALLINT,
    min_temp SMALLINT,
    max_temp SMALLINT,
    resource_info INT,
    fleet_info INT,
    defense_info INT,
    building_info INT,
    UNIQUE KEY u_space_body (galaxy , system , position , type),
    FOREIGN KEY (player_id)
        REFERENCES player (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (sattelite_id)
        REFERENCES space_body (id)
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE research_info (
    id INT NOT NULL PRIMARY KEY,
    player_id INT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    energy TINYINT,
    laser TINYINT,
    ion TINYINT,
    hyperspace TINYINT,
    plasma TINYINT,
    espionage TINYINT,
    computer TINYINT,
    astrophysics TINYINT,
    intergalactic TINYINT,
    graviton TINYINT,
    combustion_drive TINYINT,
    impulse_drive TINYINT,
    hyperspace_drive TINYINT,
    weapons_upgrade TINYINT,
    shielding_upgrade TINYINT,
    armor_upgrade TINYINT,
    UNIQUE KEY (player_id , timestamp),
    FOREIGN KEY (player_id)
        REFERENCES player (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

alter table player
  add constraint fk_player_main foreign key (main_planet) references space_body(id) on delete restrict on update cascade,
  add constraint fk_player_research foreign key (research_info) references research_info(id) on delete set null on update cascade;

CREATE TABLE building_info (
    id INT NOT NULL PRIMARY KEY,
    planet_id INT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    metal_mine TINYINT,
    crystal_mine TINYINT,
    deut_mine TINYINT,
    metal_storage TINYINT,
    crystal_storage TINYINT,
    deut_storage TINYINT,
    solar_plant TINYINT,
    fusion_reactor TINYINT,
    robotics TINYINT,
    nanite TINYINT,
    shipyard TINYINT,
    research_lab TINYINT,
    terraformer TINYINT,
    alliance_depot TINYINT,
    missile_silo TINYINT,
    space_dock TINYINT,
    lunar_base TINYINT,
    sensor_phalanx TINYINT,
    jump_gate TINYINT,
    UNIQUE KEY (planet_id , timestamp),
    FOREIGN KEY (planet_id)
        REFERENCES space_body (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE defense_info (
    id INT NOT NULL PRIMARY KEY,
    planet_id INT NOT NULL,
    timestamp TIMESTAMP NULL,
    rocket_launcher INT,
    light_laser INT,
    heavy_laser INT,
    ion_cannon INT,
    gauss_cannon INT,
    plasma_turret INT,
    small_shield TINYINT,
    large_shield TINYINT,
    anti_ballistic SMALLINT,
    interplanetary SMALLINT,
    UNIQUE KEY (planet_id , timestamp),
    FOREIGN KEY (planet_id)
        REFERENCES space_body (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE fleet_info (
    id INT NOT NULL PRIMARY KEY,
    planet_id INT NOT NULL,
    timestamp TIMESTAMP NULL,
    light_fighter INT,
    heavy_fighter INT,
    cruiser INT,
    battleship INT,
    battlecruiser INT,
    bomber INT,
    destroyer INT,
    death_star INT,
    small_cargo INT,
    large_cargo INT,
    colony_ship INT,
    recycler INT,
    espionage_probe INT,
    solar_satellite INT,
    UNIQUE KEY (planet_id , timestamp),
    FOREIGN KEY (planet_id)
        REFERENCES space_body (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE resource_info (
    id INT NOT NULL PRIMARY KEY,
    planet_id INT NOT NULL,
    timestamp TIMESTAMP NULL,
    metal INT NOT NULL,
    crystal INT NOT NULL,
    deut INT NOT NULL,
    energy INT NOT NULL,
    UNIQUE KEY (planet_id , timestamp),
    FOREIGN KEY (planet_id)
        REFERENCES space_body (id)
        ON DELETE CASCADE ON UPDATE CASCADE
);

alter table space_body
  add constraint fk_planet_resource foreign key (resource_info) references resource_info(id) on delete set null on update cascade,
  add constraint fk_planet_fleet foreign key (fleet_info) references fleet_info(id) on delete set null on update cascade,
  add constraint fk_planet_defense foreign key (defense_info) references defense_info(id) on delete set null on update cascade,
  add constraint fk_planet_building foreign key (building_info) references building_info(id) on delete set null on update cascade;
