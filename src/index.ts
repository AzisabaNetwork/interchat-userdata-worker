/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
	// Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
	KV: KVNamespace;
	//
	// Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
	// MY_DURABLE_OBJECT: DurableObjectNamespace;
	//
	// Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
	// MY_BUCKET: R2Bucket;
	//
	// Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
	// MY_SERVICE: Fetcher;
	//
	// Example binding to a Queue. Learn more at https://developers.cloudflare.com/queues/javascript-apis/
	// MY_QUEUE: Queue;
	HYPIXEL_API_KEY: string;
}

export type HypixelPlayerData = {
	prefix?: string;
	rank?: string;
	newPackageRank?: string; // NONE
	packageRank?: string; // NONE
	rankPlusColor?: string; // RED
	monthlyPackageRank?: string; // NONE
	monthlyRankColor?: string; // GOLD
}

export type HypixelPlayerDataResult = {
	success: boolean;
	player?: HypixelPlayerData;
}

export type CachedValue<T> = {
	expires_at: number;
	value: T;
}

export const translateChatColor = (name: string) => {
	switch (name) {
		case 'BLACK': return '&0'
		case 'DARK_BLUE': return '&1'
		case 'DARK_GREEN': return '&2'
		case 'DARK_AQUA': return '&3'
		case 'DARK_RED': return '&4'
		case 'DARK_PURPLE': return '&5'
		case 'GOLD': return '&6'
		case 'GRAY': return '&7'
		case 'DARK_GRAY': return '&8'
		case 'BLUE': return '&9'
		case 'GREEN': return '&a'
		case 'AQUA': return '&b'
		case 'RED': return '&c'
		case 'LIGHT_PURPLE': return '&d'
		case 'YELLOW': return '&e'
		case 'WHITE': return '&f'
		case 'MAGIC': return '&k'
		case 'BOLD': return '&l'
		case 'STRIKETHROUGH': return '&m'
		case 'UNDERLINE': return '&n'
		case 'ITALIC': return '&o'
		case 'RESET': return '&r'
		default: return ''
	}
}

export const getPrefix = (data: HypixelPlayerData) => {
	if (data.prefix) return data.prefix + ' '
	if (data.rank === 'ADMIN') return '&c[ADMIN] '
	if (data.rank === 'GAME_MASTER') return '&2[GM] '
	if (data.rank === 'MODERATOR') return '&2[MOD] '
	if (data.rank === 'YOUTUBER' || data.newPackageRank === 'YOUTUBER') return '&c[&fYOUTUBE&c] '
	if (data.monthlyPackageRank === 'SUPERSTAR') {
		const color = translateChatColor(data.monthlyRankColor || 'GOLD')
		return `${color}[MVP${translateChatColor(data.rankPlusColor || 'RED')}++${color}] `
	}
	if (data.newPackageRank === 'MVP_PLUS' || data.packageRank === 'MVP_PLUS') {
		return `&b[MVP${translateChatColor(data.rankPlusColor || 'RED')}+&b] `
	}
	if (data.newPackageRank === 'MVP' || data.packageRank === 'MVP') {
		return `&b[MVP] `
	}
	if (data.newPackageRank === 'VIP_PLUS' || data.packageRank === 'VIP_PLUS') {
		return `&a[VIP&6+&a] `
	}
	if (data.newPackageRank === 'VIP' || data.packageRank === 'VIP') {
		return `&a[VIP] `
	}
	console.warn(`Default rank: ${data.rank}, ${data.monthlyPackageRank}, ${data.newPackageRank}, ${data.packageRank}`)
	return '&7'
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url)
		if (url.pathname === '/userdata' && request.method === 'GET') {
			const uuid = url.searchParams.get('uuid')
			if (!uuid || uuid.length !== 36 || !/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/.test(uuid)) {
				return new Response(null, { status: 400 })
			}
			const server = url.searchParams.get('server')
			if (!server) {
				return new Response(null, { status: 400 })
			}
			if (server.endsWith('.hypixel.net') || server === 'hypixel.net') {
				let cached: CachedValue<HypixelPlayerData> | null = await env.KV.get(`${uuid}:hypixel.net`, { type: 'json' })
			  if (!cached || cached.expires_at < Date.now()) {
					const value: HypixelPlayerDataResult = await fetch('https://api.hypixel.net/player?uuid=' + uuid, {
						headers: {
							'API-Key': env.HYPIXEL_API_KEY,
						}
					}).then(res => res.json())
					if (value.success) {
						cached = { expires_at: Date.now() + 1000 * 60 * 60 * 24 * 7, value: value.player! }
					} else {
						cached = { expires_at: Date.now() + 1000 * 60 * 60 * 12, value: cached?.value || {} }
					}
					await env.KV.put(`${uuid}:hypixel.net`, JSON.stringify(cached))
				}
				return new Response(getPrefix(cached.value))
			}
			return new Response('')
		}
		return new Response(null, { status: 404 });
	},
};
