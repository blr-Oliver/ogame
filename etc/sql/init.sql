update galaxy_report_slot set player_id = 101497, player_name = 'Scrap Collector'
  where player_id is null and planet_id is not null and planet_name != 'Уничтоженная планета';


insert into space_body (id, name, galaxy, system, position, type)
	select planet_id as id, planet_name as name, galaxy, system, position, 1 as type from galaxy_report_slot where planet_id is not null
	union all
	select moon_id, 'Луна', galaxy, system, position, 3 from galaxy_report_slot where moon_id is not null
on duplicate key update
	id = values(id),
	name = values(name),
  sattelite_id = values(sattelite_id);

update space_body a join space_body b
  on a.galaxy = b.galaxy
  and a.system = b.system
  and a.position = b.position
  and a.type != b.type
set a.sattelite_id = b.id;

insert into player(id, name, main_planet)
select player_id, min(player_name) as name, min(planet_id) as main_planet from galaxy_report_slot
	where player_id is not null
    group by player_id
on duplicate key update name = values(name), main_planet = values(main_planet);

update space_body a join galaxy_report_slot b
  on a.galaxy = b.galaxy
  and a.system = b.system
  and a.position = b.position
set a.player_id = b.player_id;

update space_body a join galaxy_report_slot b
	on a.galaxy = b.galaxy
	and a.system = b.system
	and a.position = b.position
set a.size = b.moon_size
where a.type = 3;

insert into alliance (id, name, short_name)
select distinct alliance_id, alliance_name, alliance_name from galaxy_report_slot where alliance_id is not null
on duplicate key update name = values(name);

update player a join galaxy_report_slot b
on a.id = b.player_id
set a.alliance_id = b.alliance_id;
