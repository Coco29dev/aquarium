// Tables de données utilisateur couvertes par l'export JSON et la restauration.
// C'est LA liste à compléter quand une nouvelle table de données apparaît : l'export (data.ts) et la
// restauration (restore.ts) la lisent toutes les deux. Fichier sans accès base : utilisable dans les tests.

export interface TableRef {
	/** Colonne de la table qui référence une autre table du même export. */
	column: string;
	/** Clé d'export de la table référencée. */
	to: string;
	/** La valeur peut être nulle (ex. dépense sans aquarium). */
	nullable?: boolean;
}

export interface TableSpec {
	table: string;
	/** Clé dans le fichier d'export JSON. */
	key: string;
	/** Libellé français pour les messages. */
	label: string;
	refs?: TableRef[];
	/** La table peut ne pas exister (migration pas encore appliquée) : on l'ignore alors. */
	optionalTable?: boolean;
}

/** Ordre d'insertion : une table vient après celles qu'elle référence. */
export const RESTORE_TABLES: TableSpec[] = [
	{ table: 'aquariums', key: 'aquariums', label: 'aquariums' },
	{ table: 'photos', key: 'photos', label: 'photos', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'parameter_defs', key: 'parameters', label: 'paramètres', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'recurring_tasks', key: 'recurringTasks', label: 'tâches', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{
		table: 'measurements',
		key: 'measurements',
		label: 'mesures',
		refs: [
			{ column: 'aquarium_id', to: 'aquariums' },
			{ column: 'parameter_id', to: 'parameters' }
		]
	},
	{ table: 'task_completions', key: 'taskCompletions', label: 'réalisations de tâches', refs: [{ column: 'task_id', to: 'recurringTasks' }] },
	{ table: 'inhabitants', key: 'inhabitants', label: 'habitants', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'equipment', key: 'equipment', label: 'équipements', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'consumables', key: 'consumables', label: 'consommables', refs: [{ column: 'equipment_id', to: 'equipment' }] },
	{
		table: 'consumable_replacements',
		key: 'consumableReplacements',
		label: 'remplacements de consommables',
		refs: [{ column: 'consumable_id', to: 'consumables' }]
	},
	{ table: 'expenses', key: 'expenses', label: 'dépenses', refs: [{ column: 'aquarium_id', to: 'aquariums', nullable: true }] },
	{ table: 'notes', key: 'notes', label: 'notes', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'events', key: 'events', label: 'événements', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{ table: 'feedings', key: 'feedings', label: 'nourrissages', refs: [{ column: 'aquarium_id', to: 'aquariums' }] },
	{
		table: 'project_items',
		key: 'projectItems',
		label: 'éléments de projet',
		refs: [{ column: 'aquarium_id', to: 'aquariums' }],
		optionalTable: true
	},
	{
		table: 'chat_messages',
		key: 'chatMessages',
		label: "messages de l'assistant",
		refs: [{ column: 'aquarium_id', to: 'aquariums' }],
		optionalTable: true
	}
];

/** Clés d'export qui ne sont pas des tables. */
export const EXPORT_META_KEYS = ['exportedAt', 'appState'] as const;

/** Réglages applicatifs inclus dans l'export (table app_state) et restaurés avec lui. */
export const EXPORTED_STATE_KEYS = ['notification_settings'] as const;
