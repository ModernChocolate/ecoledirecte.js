import { cloudResFolder, cloudResFile, role } from "ecoledirecte-api-types/v3";
import { Account } from "../accounts";
import { fetchFile, getCloudFolder } from "../functions";

export class Cloud {
	public _root: cloudResFolder;
	public _owner: Account;
	constructor(root: cloudResFolder, owner: Account) {
		this._root = root;
		this._owner = owner;
		if (root.quota === undefined)
			throw new Error("This doesn't seem to be the cloud's root.");
	}

	get quota(): number {
		return this._root.quota as number;
	}

	get size(): number {
		return this._root.taille;
	}

	async root(): Promise<Folder> {
		return new Folder(this._root, this);
	}

	// async get(path: string): Promise<Folder | File> {
	// 	throw new Error("Unavailable");
	// }
}

export class Folder {
	type: "folder" = "folder";
	name: string;
	path: string;
	size: number;
	children: Array<Folder | File>;
	_raw: cloudResFolder;
	private _cloud: Cloud;
	constructor(o: cloudResFolder, cloud: Cloud) {
		const pathPrefix = cloud._root.id;

		this._cloud = cloud;
		this._raw = o;
		this.name = o.libelle;
		this.path = cleanPath(o.id, pathPrefix);
		this.size = o.taille;
		this.children = o.children.map(c => {
			if (!["folder", "file"].includes(c.type))
				throw new Error(`Unexpected cloud type: ${c.type}`);
			return c.type === "folder" ? new Folder(c, cloud) : new File(c, cloud);
		});
	}

	// getFullPath() {}

	/**
	 * @description Non-destructive
	 */
	// refresh() {}

	async loadFullTree(): Promise<Folder> {
		const fullTree = await getFullTree(this._raw, this._cloud);
		// function cleanBranch(folder: cloudResFolder) {
		// 	const tree: any = {};
		// 	folder.children.forEach(
		// 		c => (tree[c.libelle] = c.type === "folder" ? cleanBranch(c) : c.type)
		// 	);
		// 	return tree;
		// }
		// return cleanBranch(fullTree);
		return new Folder(fullTree, this._cloud);
	}

	// toJSON() {}
}

export class File {
	type: "file" = "file";
	name: string;
	path: string;
	extension: string;
	date: Date;
	owner?: {
		id: number;
		type: role;
		firstName: string;
		lastName: string;
		particle?: string;
	};
	_raw: cloudResFile;
	private _cloud: Cloud;
	constructor(o: cloudResFile, cloud: Cloud) {
		const pathPrefix = cloud._root.id;
		this._cloud = cloud;
		this._raw = o;
		this.name = o.libelle;
		this.path = cleanPath(o.id, pathPrefix);
		this.date = new Date(o.date);
		this.owner = o.proprietaire
			? {
					id: o.proprietaire.id,
					type: o.proprietaire.type,
					firstName: o.proprietaire.prenom,
					lastName: o.proprietaire.nom,
					particle: o.proprietaire.particule || undefined,
			  }
			: undefined;
		this.extension = getExtension(o.libelle);
	}

	private _downloaded?: Buffer;
	private _downloadedUri?: string;

	async download(token?: string): Promise<Buffer> {
		const [buf, str] = await fetchFile(
			this._raw.id,
			token || this._cloud._owner.token
		);
		this._downloaded = buf;
		this._downloadedUri = str;
		return buf;
	}

	get downloaded(): { buffer?: Buffer; uri?: string } {
		return {
			buffer: this._downloaded,
			uri: this._downloadedUri,
		};
	}

	// toJSON() {}
}

export function getExtension(name: string): string {
	const dotSplit = name.split("."),
		dotLast = dotSplit[dotSplit.length - 1],
		extension = dotLast !== name && !!dotLast ? dotLast : "";
	return extension;
}

export function cleanPath(dirty: string, prefix: string): string {
	if (dirty === prefix) return "/";
	if (dirty.indexOf(prefix) === -1) throw new Error("Prefix expected");
	const clean =
		"/" +
		dirty
			.substr(dirty.indexOf(prefix) + (prefix + "\\").length)
			.replace(/\\/g, "/");
	return clean;
}

export async function getFullTree(
	folder: cloudResFolder,
	cloud: Cloud
): Promise<cloudResFolder> {
	let newFolder = folder;
	// Load folder
	if (!folder.isLoaded) {
		const folderRes = await getCloudFolder(
			cloud._owner,
			encodeURI(cleanPath(folder.id, cloud._root.id).replace(/\//g, "\\"))
		);
		cloud._owner.token = folderRes.token;
		newFolder = folderRes.data[0];
	}
	// Recursively call function
	newFolder.children = await Promise.all(
		newFolder.children.map(async c =>
			c.type === "folder" ? getFullTree(c, cloud) : c
		)
	);

	return newFolder;
}
