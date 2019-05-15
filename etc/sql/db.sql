create SCHEMA `ogame` DEFAULT CHARACTER SET utf8;

create USER 'ogame-api'@'localhost' IDENTIFIED BY 'scrap_collector';
grant select, insert, update, delete, execute ON ogame.* TO 'ogame-api'@'localhost';
