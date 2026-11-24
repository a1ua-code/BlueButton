CREATE TABLE "hidden_parties" (
	"user_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hidden_parties_user_id_party_id_pk" PRIMARY KEY("user_id","party_id")
);
--> statement-breakpoint
ALTER TABLE "hidden_parties" ADD CONSTRAINT "hidden_parties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_parties" ADD CONSTRAINT "hidden_parties_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE cascade ON UPDATE no action;