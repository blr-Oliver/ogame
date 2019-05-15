drop table if exists galaxy_report_slot;
drop table if exists galaxy_report;

create table galaxy_report (
  galaxy tinyint not null,
  system smallint not null,
  timestamp timestamp,
  empty boolean not null,
  primary key(galaxy, system)
);

create table galaxy_report_slot (
  galaxy tinyint not null,
  system smallint not null,
  position tinyint not null,
  planet_id int,
  planet_name varchar(200),
  moon_id int,
  moon_size smallint,
  player_id int,
  player_name varchar(200),
  player_status varchar(50),
  player_rank smallint,
  alliance_id int,
  alliance_name varchar(200),
  alliance_rank smallint,
  alliance_members smallint,
  debris_metal int,
  debris_crystal int,
  primary key(galaxy, system, position)
);
