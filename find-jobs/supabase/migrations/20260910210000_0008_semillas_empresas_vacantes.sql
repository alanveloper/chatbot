-- 0008_semillas_empresas_vacantes
-- Datos DEMO: empresas y puestos ficticios. Sirven para probar el producto;
-- no representan ofertas, sueldos ni cultura de organizaciones reales.

create temporary table seed_empresas (
  nombre text primary key, sector text, tamano text, pais text, modalidad text,
  descripcion text, mision text, vision text, proposito text, valor_1 text, valor_2 text
) on commit drop;

insert into seed_empresas values
('Nube Clara','Tecnología SaaS','51-200','México','remoto','Plataforma para simplificar la administración de pequeños negocios.','Hacer la gestión empresarial más simple.','Que cualquier negocio pueda operar con claridad digital.','Reducir la carga administrativa.','Autonomía','Aprendizaje'),
('Mesa Sur','Hospitalidad','201-500','México','presencial','Grupo de restaurantes de cocina mexicana contemporánea.','Crear experiencias cálidas alrededor de la mesa.','Ser referente de hospitalidad consciente.','Cuidar a quien sirve y a quien visita.','Servicio','Trabajo en equipo'),
('VerdeRaíz','Agrotecnología','11-50','México','híbrido','Red de agricultura regenerativa y trazabilidad alimentaria.','Conectar alimentos sanos con prácticas justas.','Un campo rentable que regenere el suelo.','Hacer visible el origen de cada alimento.','Sustentabilidad','Colaboración'),
('Punto Cero Contact','Atención al cliente','501-1000','México','híbrido','Centro de experiencia para marcas de servicios.','Resolver cada contacto con respeto y claridad.','Elevar el estándar de atención en México.','Convertir problemas en confianza.','Empatía','Claridad'),
('Prisma Legal','Servicios legales','11-50','México','híbrido','Despacho enfocado en emprendimientos y propiedad intelectual.','Dar certeza legal a quienes crean.','Ser el aliado legal más claro para pymes.','Traducir lo complejo a decisiones útiles.','Rigor','Accesibilidad'),
('Ruta Norte','Logística','201-500','México','presencial','Operador de distribución de última milla para el norte del país.','Mover mercancía de forma confiable.','Una red logística puntual y humana.','Hacer que cada entrega cuente.','Responsabilidad','Seguridad'),
('Lumen Aula','Educación digital','51-200','México','remoto','Cursos y acompañamiento para formación técnica.','Abrir oportunidades mediante aprendizaje práctico.','Aprendizaje accesible durante toda la vida.','Acompañar el progreso real de cada estudiante.','Inclusión','Mejora continua'),
('Brújula Salud','Salud preventiva','51-200','México','híbrido','Clínicas de prevención y seguimiento de salud familiar.','Prevenir antes de que un problema crezca.','Atención preventiva cercana para todas las familias.','Hacer fácil cuidar la salud.','Cuidado','Confidencialidad'),
('Sol Alta','Energía renovable','11-50','México','híbrido','Diseño e instalación de soluciones solares para comercios.','Acelerar la transición a energía limpia.','Ciudades que generen su propia energía.','Volver rentable la sostenibilidad.','Impacto','Seguridad'),
('Marea Estudio','Diseño y comunicación','11-50','México','remoto','Estudio creativo para marcas culturales y sociales.','Dar forma visual a ideas con impacto.','Diseño honesto que acerque proyectos a su comunidad.','Crear con intención y oficio.','Creatividad','Honestidad'),
('Forja MX','Manufactura','201-500','México','presencial','Fabricante de componentes metálicos industriales.','Fabricar con calidad y seguridad.','Ser una planta confiable que desarrolla talento técnico.','Hacer bien las cosas desde la primera vez.','Disciplina','Seguridad'),
('Tejido Urbano','Moda sostenible','51-200','México','híbrido','Marca de ropa con producción local y materiales recuperados.','Vestir con menor impacto y mayor dignidad.','Una industria textil circular y justa.','Demostrar que la moda puede cuidar.','Transparencia','Dignidad'),
('Cívica Abierta','Tecnología cívica','11-50','México','remoto','Herramientas digitales para gobiernos locales y comunidades.','Acercar lo público a las personas.','Servicios públicos comprensibles y participativos.','Convertir datos en decisiones comunitarias.','Participación','Transparencia'),
('Faro Finanzas','Fintech','51-200','México','híbrido','Productos financieros para trabajadores independientes.','Dar control financiero a quien trabaja por su cuenta.','Finanzas justas y simples para millones de personas.','Reducir la incertidumbre económica.','Equidad','Claridad'),
('Órbita Viajes','Turismo responsable','51-200','México','híbrido','Experiencias de viaje con operadores comunitarios.','Viajar dejando beneficios en el territorio.','Turismo que conserve cultura y naturaleza.','Conectar viajeros con comunidades anfitrionas.','Respeto','Curiosidad'),
('Taller Horizonte','Construcción','51-200','México','presencial','Constructora de vivienda y espacios comunitarios.','Construir espacios seguros y durables.','Barrios mejor conectados y habitables.','Transformar planos en lugares para vivir.','Calidad','Seguridad'),
('Veta Datos','Analítica de datos','11-50','México','remoto','Consultora de datos para organizaciones de impacto.','Hacer decisiones más inteligentes con datos confiables.','Datos útiles al servicio de mejores decisiones.','Convertir preguntas en evidencia accionable.','Rigor','Curiosidad'),
('Amanecer Café','Alimentos y bebidas','51-200','México','presencial','Tostador y cadena local de cafeterías de comercio directo.','Servir café excelente con comercio justo.','Una cadena de café que cuide toda su comunidad.','Conectar el origen con cada taza.','Hospitalidad','Comercio justo'),
('Puente Talento','Recursos humanos','11-50','México','remoto','Plataforma de empleabilidad y desarrollo profesional.','Acercar oportunidades a talento diverso.','Mercados laborales más incluyentes y transparentes.','Hacer que el trabajo adecuado sea más accesible.','Inclusión','Confianza'),
('Álamo Seguros','Seguros','201-500','México','híbrido','Aseguradora digital para familias y pequeños negocios.','Proteger lo importante con procesos claros.','Seguros simples que sí acompañen.','Responder cuando una persona más lo necesita.','Confianza','Servicio');

-- No se presupone una restricción UNIQUE sobre empresas.nombre en instalaciones
-- anteriores; esta forma permite ejecutar la semilla una sola vez sin duplicar.
insert into public.empresas (nombre, sector, tamano, pais, modalidad, descripcion, mision, vision, proposito)
select s.nombre, s.sector, s.tamano, s.pais, s.modalidad, s.descripcion, s.mision, s.vision, s.proposito
from seed_empresas s
where not exists (select 1 from public.empresas e where e.nombre = s.nombre);

insert into public.empresa_valores (empresa_id, valor, importancia, descripcion, evidencia)
select e.id, x.valor, x.importancia, 'Valor declarado para el entorno de trabajo.', 'Dato demo; validar con entrevistas al equipo.'
from seed_empresas s
join public.empresas e on e.nombre = s.nombre
cross join lateral (values (s.valor_1, 5::smallint), (s.valor_2, 4::smallint)) x(valor, importancia)
where not exists (select 1 from public.empresa_valores ev where ev.empresa_id = e.id and ev.valor = x.valor);

create temporary table seed_vacantes (
  empresa text, codigo text, titulo text, area text, seniority text, modalidad text,
  ciudad text, tipo_contrato text, jornada text, sueldo_min numeric, sueldo_max numeric,
  ingles text, horas smallint, descripcion text, actividad text, prestacion text,
  autonomia smallint, interaccion smallint, estructura smallint, ritmo smallint
) on commit drop;

insert into seed_vacantes values
('Nube Clara','NC-101','Desarrollador/a Frontend','Tecnología','mid','remoto','Remoto México','indefinido','tiempo completo',32000,45000,'B1',40,'Construye interfaces accesibles para la plataforma de gestión.','Desarrollar y probar componentes React con diseño y producto.','Home office y presupuesto anual de aprendizaje.',4,2,3,3),
('Nube Clara','NC-102','Especialista de Soporte Técnico','Operaciones','junior','remoto','Remoto México','indefinido','tiempo completo',18000,24000,'B1',40,'Acompaña a negocios que usan la plataforma.','Resolver consultas por chat y documentar patrones recurrentes.','Horario flexible y terapia en línea.',3,4,4,4),
('Mesa Sur','MS-101','Supervisor/a de Servicio','Operaciones','mid','presencial','Ciudad de México','indefinido','turno completo',19000,25000,'A2',48,'Coordina la experiencia de comensales y el equipo de piso.','Organizar turnos y resolver incidencias de servicio en sitio.','Comidas durante turno y propinas compartidas.',3,5,3,5),
('Mesa Sur','MS-102','Cocinero/a de Línea','Cocina','junior','presencial','Ciudad de México','indefinido','turno completo',12000,16000,'A1',48,'Prepara platillos siguiendo estándares de calidad e higiene.','Preparar estación, producir platillos y controlar mermas.','Comidas durante turno y capacitación culinaria.',2,3,5,5),
('VerdeRaíz','VR-101','Técnico/a de Campo','Operaciones','junior','híbrido','Puebla','indefinido','tiempo completo',16000,22000,'A2',44,'Acompaña a productores en prácticas regenerativas.','Visitar parcelas, levantar datos y orientar prácticas de cultivo.','Viáticos de campo y equipo de seguridad.',4,4,2,4),
('VerdeRaíz','VR-102','Analista de Trazabilidad','Datos','mid','híbrido','Puebla','indefinido','tiempo completo',26000,36000,'B1',40,'Mantiene datos de origen y calidad de productos agrícolas.','Validar registros de proveedores y generar reportes de trazabilidad.','Home office dos días y seguro médico.',3,2,5,3),
('Punto Cero Contact','PC-101','Asesor/a de Atención por Chat','Atención al cliente','junior','híbrido','Monterrey','indefinido','turno completo',13000,17000,'A2',48,'Resuelve consultas de clientes de telecomunicaciones por canales digitales.','Atender conversaciones simultáneas y registrar soluciones.','Bono de desempeño y transporte nocturno.',2,5,5,5),
('Punto Cero Contact','PC-102','Analista de Calidad','Calidad','mid','híbrido','Monterrey','indefinido','tiempo completo',19000,26000,'B1',40,'Evalúa interacciones para mejorar la experiencia de servicio.','Auditar conversaciones y retroalimentar a equipos de atención.','Bono de desempeño y plan de carrera.',3,3,5,4),
('Prisma Legal','PL-101','Paralegal Corporativo','Legal','junior','híbrido','Ciudad de México','indefinido','tiempo completo',18000,24000,'B1',40,'Apoya trámites societarios y contratos para pymes.','Preparar expedientes, revisar documentos y dar seguimiento a trámites.','Horario flexible y mentoría profesional.',2,3,5,4),
('Prisma Legal','PL-102','Abogado/a de Propiedad Intelectual','Legal','mid','híbrido','Ciudad de México','indefinido','tiempo completo',30000,42000,'B2',45,'Asesora registros de marca y estrategia de propiedad intelectual.','Elaborar escritos y asesorar clientes en decisiones de registro.','Días personales y apoyo a certificaciones.',4,4,4,4),
('Ruta Norte','RN-101','Coordinador/a de Ruta','Logística','mid','presencial','Monterrey','indefinido','turno completo',21000,28000,'A2',48,'Coordina salidas, incidencias y entregas de última milla.','Asignar rutas y reaccionar a retrasos durante la operación.','Vales de despensa y bono de puntualidad.',4,5,4,5),
('Ruta Norte','RN-102','Auxiliar de Almacén','Logística','junior','presencial','Monterrey','indefinido','turno completo',11000,14500,'A1',48,'Recibe, acomoda y prepara mercancía para distribución.','Surtir pedidos y registrar entradas con escáner.','Vales de despensa y equipo de seguridad.',2,3,5,5),
('Lumen Aula','LA-101','Diseñador/a Instruccional','Educación','mid','remoto','Remoto México','indefinido','tiempo completo',25000,35000,'B2',40,'Convierte contenido experto en experiencias de aprendizaje prácticas.','Diseñar rutas de aprendizaje y evaluar actividades de curso.','Presupuesto de cursos y horario flexible.',4,3,3,3),
('Lumen Aula','LA-102','Asesor/a de Éxito Estudiantil','Educación','junior','remoto','Remoto México','indefinido','tiempo completo',17000,22000,'B1',40,'Acompaña a estudiantes para que completen sus programas.','Dar seguimiento por videollamada y proponer planes de avance.','Días de bienestar y apoyo de internet.',3,5,4,4),
('Brújula Salud','BS-101','Enfermero/a de Prevención','Salud','mid','híbrido','Guadalajara','indefinido','tiempo completo',20000,27000,'A2',40,'Realiza valoraciones iniciales y seguimiento preventivo.','Tomar signos, educar pacientes y registrar planes de cuidado.','Seguro médico y apoyo de transporte.',3,5,5,4),
('Brújula Salud','BS-102','Coordinador/a de Recepción','Operaciones','mid','presencial','Guadalajara','indefinido','tiempo completo',17000,23000,'A2',48,'Organiza agenda, recepción y flujo de pacientes.','Distribuir citas y resolver incidencias de atención.','Seguro médico y días personales.',3,5,4,5),
('Sol Alta','SA-101','Ingeniero/a de Proyectos Solares','Ingeniería','mid','híbrido','Querétaro','indefinido','tiempo completo',28000,39000,'B1',45,'Diseña sistemas fotovoltaicos para clientes comerciales.','Dimensionar instalaciones y coordinar visitas técnicas.','Viáticos y certificaciones técnicas.',4,3,4,4),
('Sol Alta','SA-102','Técnico/a Instalador/a Solar','Operaciones','junior','presencial','Querétaro','indefinido','tiempo completo',15000,21000,'A1',48,'Instala y da mantenimiento a sistemas fotovoltaicos.','Montar equipos y ejecutar listas de verificación de seguridad.','Equipo de seguridad y bono por proyecto.',3,3,5,5),
('Marea Estudio','ME-101','Diseñador/a de Marca','Diseño','mid','remoto','Remoto México','por proyecto','tiempo completo',24000,34000,'B1',40,'Desarrolla identidades visuales para proyectos culturales.','Crear conceptos, sistemas gráficos y presentaciones a clientes.','Horario flexible y presupuesto creativo.',5,3,2,3),
('Marea Estudio','ME-102','Gestor/a de Cuentas','Operaciones','mid','remoto','Remoto México','indefinido','tiempo completo',22000,30000,'B2',40,'Coordina proyectos creativos y comunicación con clientes.','Alinear entregables, cronogramas y expectativas de clientes.','Días de recarga y trabajo remoto.',4,5,3,4),
('Forja MX','FM-101','Inspector/a de Calidad','Calidad','junior','presencial','Saltillo','indefinido','turno completo',15000,20000,'A2',48,'Verifica que componentes metálicos cumplan especificaciones.','Medir piezas y documentar no conformidades de producción.','Fondo de ahorro y equipo de seguridad.',2,2,5,4),
('Forja MX','FM-102','Técnico/a de Mantenimiento','Mantenimiento','mid','presencial','Saltillo','indefinido','turno completo',20000,29000,'A2',48,'Mantiene maquinaria de producción disponible y segura.','Diagnosticar fallas y ejecutar mantenimiento preventivo.','Fondo de ahorro y prima de turno.',4,3,5,5),
('Tejido Urbano','TU-101','Patronista Digital','Diseño','mid','híbrido','Ciudad de México','indefinido','tiempo completo',22000,30000,'A2',40,'Desarrolla patrones para colecciones de producción local.','Crear patrones digitales y acompañar pruebas de ajuste.','Descuento de marca y horario flexible.',4,3,4,3),
('Tejido Urbano','TU-102','Coordinador/a de Producción','Operaciones','mid','presencial','Ciudad de México','indefinido','tiempo completo',21000,29000,'A2',45,'Coordina talleres, calendario y calidad de producción.','Planear órdenes y resolver cuellos de botella con talleres.','Descuento de marca y vales de despensa.',4,5,4,5),
('Cívica Abierta','CA-101','Desarrollador/a Full Stack','Tecnología','mid','remoto','Remoto México','indefinido','tiempo completo',34000,48000,'B2',40,'Construye herramientas web para trámites y participación ciudadana.','Desarrollar funcionalidades y colaborar con investigación de usuarios.','Horario flexible y presupuesto de aprendizaje.',4,3,3,3),
('Cívica Abierta','CA-102','Investigador/a de Usuario','Investigación','mid','remoto','Remoto México','por proyecto','tiempo completo',26000,36000,'B2',40,'Investiga cómo personas usan servicios públicos digitales.','Entrevistar usuarios y sintetizar hallazgos accionables.','Trabajo remoto y días de bienestar.',4,5,2,3),
('Faro Finanzas','FF-101','Analista de Riesgo','Finanzas','mid','híbrido','Ciudad de México','indefinido','tiempo completo',30000,42000,'B2',40,'Analiza riesgo crediticio de trabajadores independientes.','Construir reportes de riesgo y monitorear portafolios.','Seguro médico y bono anual.',3,2,5,4),
('Faro Finanzas','FF-102','Especialista de Operaciones Financieras','Operaciones','junior','híbrido','Ciudad de México','indefinido','tiempo completo',18000,25000,'B1',40,'Gestiona operaciones y aclaraciones de productos financieros.','Conciliar movimientos y resolver casos de clientes.','Seguro médico y home office dos días.',3,4,5,4),
('Órbita Viajes','OV-101','Diseñador/a de Experiencias','Turismo','mid','híbrido','Oaxaca','indefinido','tiempo completo',22000,31000,'B1',40,'Diseña itinerarios junto con comunidades anfitrionas.','Coordinar operadores locales y documentar experiencias de viaje.','Viajes de familiarización y días flexibles.',4,5,2,3),
('Órbita Viajes','OV-102','Asesor/a de Viajes','Ventas','junior','híbrido','Oaxaca','indefinido','tiempo completo',15000,21000,'B1',45,'Orienta a viajeros antes y durante su experiencia.','Atender consultas y gestionar cambios de itinerario.','Comisiones y descuentos de viaje.',3,5,4,5),
('Taller Horizonte','TH-101','Residente de Obra','Construcción','mid','presencial','Mérida','indefinido','tiempo completo',26000,36000,'A2',48,'Supervisa calidad, avance y seguridad en proyectos de vivienda.','Coordinar frentes de obra y verificar estimaciones.','Viáticos y seguro de vida.',4,5,5,5),
('Taller Horizonte','TH-102','Dibujante Técnico/a','Construcción','junior','presencial','Mérida','indefinido','tiempo completo',16000,22000,'A2',40,'Elabora planos y actualiza documentación técnica.','Modelar planos y preparar láminas para permisos.','Seguro de vida y capacitación técnica.',3,2,5,3),
('Veta Datos','VD-101','Analista de Datos','Datos','mid','remoto','Remoto México','indefinido','tiempo completo',30000,42000,'B2',40,'Analiza datos para proyectos sociales y de política pública.','Limpiar datos, crear tableros y explicar hallazgos.','Trabajo remoto y apoyo de coworking.',4,3,4,3),
('Veta Datos','VD-102','Consultor/a de Impacto','Consultoría','mid','remoto','Remoto México','por proyecto','tiempo completo',28000,39000,'B2',40,'Acompaña a organizaciones a definir y medir su impacto.','Facilitar talleres y traducir indicadores en decisiones.','Días de bienestar y formación continua.',4,5,3,4),
('Amanecer Café','AC-101','Barista','Hospitalidad','junior','presencial','Ciudad de México','indefinido','turno completo',10500,14000,'A1',48,'Prepara bebidas y cuida la experiencia cotidiana de clientes.','Preparar bebidas, explicar café y mantener la barra.','Propinas, comidas y capacitación.',2,5,5,5),
('Amanecer Café','AC-102','Comprador/a de Café Verde','Compras','mid','híbrido','Ciudad de México','indefinido','tiempo completo',24000,33000,'B1',40,'Gestiona compras directas y calidad de café de origen.','Negociar compras y evaluar muestras de productores.','Viajes de origen y seguro médico.',4,4,3,3),
('Puente Talento','PT-101','Orientador/a Laboral','Recursos humanos','mid','remoto','Remoto México','indefinido','tiempo completo',21000,29000,'B1',40,'Acompaña a personas en búsqueda de empleo y desarrollo profesional.','Realizar sesiones de orientación y documentar planes de acción.','Supervisión clínica y horario flexible.',4,5,3,4),
('Puente Talento','PT-102','Recruiter de Tecnología','Recursos humanos','mid','remoto','Remoto México','indefinido','tiempo completo',25000,35000,'B2',40,'Conecta talento tecnológico con oportunidades incluyentes.','Buscar perfiles, entrevistar y acompañar procesos de selección.','Bono por contratación y días personales.',4,5,3,4),
('Álamo Seguros','AS-101','Asesor/a de Siniestros','Atención al cliente','junior','híbrido','Ciudad de México','indefinido','turno completo',16000,22000,'B1',45,'Acompaña a clientes durante reportes de siniestro.','Recibir casos, explicar cobertura y coordinar seguimiento.','Seguro médico y bono de desempeño.',3,5,5,5),
('Álamo Seguros','AS-102','Product Manager','Producto','senior','híbrido','Ciudad de México','indefinido','tiempo completo',45000,62000,'B2',40,'Define productos digitales de protección para familias.','Priorizar problemas, alinear equipos y medir resultados de producto.','Seguro médico mayor y trabajo híbrido flexible.',5,5,3,4);

insert into public.vacantes (
  empresa_id, codigo_externo, titulo, area, seniority, modalidad, ciudad, pais,
  tipo_contrato, jornada, sueldo_mxn_min, sueldo_mxn_max, sueldo_moneda, sueldo_periodo,
  ingles_req, horas_semana, descripcion, activa, nivel_autonomia, nivel_interaccion,
  nivel_estructura, nivel_ritmo, resumen_transparencia
)
select e.id, s.codigo, s.titulo, s.area, s.seniority, s.modalidad, s.ciudad, 'México',
  s.tipo_contrato, s.jornada, s.sueldo_min, s.sueldo_max, 'MXN', 'mensual', s.ingles,
  s.horas, s.descripcion, true, s.autonomia, s.interaccion, s.estructura, s.ritmo,
  'Dato demo: confirma condiciones durante el proceso de selección.'
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
where not exists (
  select 1 from public.vacantes v where v.empresa_id = e.id and v.codigo_externo = s.codigo
);

insert into public.vacante_responsabilidades (vacante_id, titulo, descripcion, porcentaje_tiempo, frecuencia, prioridad, entregable, orden)
select v.id, 'Actividad principal', s.actividad, 70, 'semanal', 5, 'Avance documentado', 1
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
join public.vacantes v on v.empresa_id = e.id and v.codigo_externo = s.codigo
where not exists (select 1 from public.vacante_responsabilidades r where r.vacante_id = v.id and r.orden = 1);

insert into public.vacante_prestaciones (vacante_id, categoria, nombre, descripcion)
select v.id, 'beneficio', s.prestacion, 'Prestación de ejemplo para pruebas de transparencia.'
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
join public.vacantes v on v.empresa_id = e.id and v.codigo_externo = s.codigo
where not exists (select 1 from public.vacante_prestaciones p where p.vacante_id = v.id and p.nombre = s.prestacion);

-- Los ocho ejes corresponden al diccionario que utiliza condiciones_persona.
insert into public.vacante_metricas_match (vacante_id, dimension, objetivo, tolerancia, peso, indispensable, razon)
select v.id, d.dimension, d.objetivo, 1, d.peso, false, 'Señal demo derivada del contexto operativo del puesto.'
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
join public.vacantes v on v.empresa_id = e.id and v.codigo_externo = s.codigo
cross join lateral (values
 ('estructura', case when s.estructura >= 4 then 2 else 0 end, 1.2::numeric),
 ('comunicacion', case when s.interaccion >= 4 then 1 else 0 end, 1.0::numeric),
 ('interrupciones', case when s.ritmo >= 4 then 1 else -1 end, 0.8::numeric),
 ('interaccion_social', case when s.interaccion >= 4 then 2 else -1 end, 1.1::numeric),
 ('entorno', case when s.modalidad = 'presencial' then 1 else -1 end, 0.8::numeric),
 ('sincronia', case when s.modalidad = 'remoto' then -1 else 1 end, 0.9::numeric),
 ('supervision', case when s.autonomia >= 4 then -1 else 1 end, 1.0::numeric),
 ('precision', case when s.estructura >= 4 then 2 else 0 end, 1.0::numeric)
) d(dimension, objetivo, peso)
where not exists (select 1 from public.vacante_metricas_match m where m.vacante_id = v.id and m.dimension = d.dimension);

insert into public.vacante_pesos_match (vacante_id, habilidades, intereses, entorno, valores, compensacion, trayectoria)
select v.id, 1.4, 1.1, 1.3, 0.9, 1.0, 1.0
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
join public.vacantes v on v.empresa_id = e.id and v.codigo_externo = s.codigo
where not exists (select 1 from public.vacante_pesos_match p where p.vacante_id = v.id);

insert into public.vacante_resultados_esperados (vacante_id, horizonte_dias, resultado, indicador_exito, orden)
select v.id, 90, 'Domina el flujo principal del puesto y entrega trabajo con acompañamiento proporcional al rol.', 'Revisión de responsable directo', 1
from seed_vacantes s join public.empresas e on e.nombre = s.empresa
join public.vacantes v on v.empresa_id = e.id and v.codigo_externo = s.codigo
where not exists (select 1 from public.vacante_resultados_esperados r where r.vacante_id = v.id and r.horizonte_dias = 90);
