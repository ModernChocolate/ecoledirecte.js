import { Account } from "./Account";
import { Session } from "../Session";

import { _loginResSuccess, familyAccount } from "../types";
import { getMainAccount, isFamilyAccount } from "../functions";

export class Family extends Account {
	public type: "family" = "family";
	private account: familyAccount;
	private token: string;

	constructor(private session: Session) {
		super(session);
		const { username, password } = session.credentials;

		const mainAccount = getMainAccount(
			(session.loginRes as _loginResSuccess).data.accounts
		);

		if (!isFamilyAccount(mainAccount))
			throw Error("Family class's main account is wrong");

		if (!session.token) throw Error("Account class MUST have token");

		this.account = mainAccount;
		this.token = session.token;
	}
}