const email: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const hexColor: RegExp =/^#([0-9a-f]{3}){1,2}$/i;
export interface Schema {
    field: string
    type: string
    required: boolean
}

export function validate(schemas: Schema[], req: any) {
    for (const schema of schemas) {
        if (schema.required && !req[schema.field]) {
            throw Error(`${schema.field} is required`)
        }
        if (req[schema.field]) {
            if (schema.type === 'email') {
                if (!email.test(req[schema.field])) throw Error(`${schema.field} is invalid`);
            } else if (schema.type === 'hexColor') {
                if (!hexColor.test(req[schema.field])) throw Error(`${schema.field} is invalid`);
            } else if (typeof req[schema.field] !== schema.type) {
                throw Error(`type ${typeof req[schema.field]} unable to assign to type ${schema.type}`)
            }
        }
    }
}

export function bind(from: any, schemas?: Schema[]): any {
    const to: any = {};
    for (const key in from) {
        if(from[key]) {
            if (!schemas || schemas.find(schema => schema.field === key)) {
                to[key] = from[key]
            }
        }
    }
    return to
}