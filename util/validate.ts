const email: RegExp = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const hexColor: RegExp =/^#([0-9a-f]{3}){1,2}$/i;
export interface Schema {
    field: string
    type: string
    required: boolean
}

export function validate(schemas: Schema[], req: any) {
    for (const schema of schemas) {
        if (schema.required && (req[schema.field] === undefined || req[schema.field] === null)) {
            throw Error(`${schema.field} is required`)
        }
        if (req[schema.field]) {
            req[schema.field] = _convert(req[schema.field], schema.type)
            if (schema.type === 'email') {
                if (!email.test(req[schema.field])) throw Error(`${schema.field} is invalid`);
            } else if (schema.type === 'hexColor') {
                if (!hexColor.test(req[schema.field])) throw Error(`${schema.field} is invalid`);
            } else if (schema.type.startsWith('array')) {
                if (!Array.isArray(req[schema.field])) throw Error(`${schema.field} is invalid`);
                const subType = schema.type.substring(6, schema.type.length-1)
                for (let value of req[schema.field]) {
                    value = _convert(value, subType)
                    if (!value || typeof value !== subType) {
                        throw Error(`${schema.field} is invalid`);
                    }
                }
            } else if (typeof req[schema.field] !== schema.type) {
                throw Error(`field '${schema.field}' has type '${typeof req[schema.field]}' that unable to assign to type '${schema.type}'`)
            }
        }
    }
}

function _convert(field: any, type: string) {
    if (type === 'number') {
        return Number(field)
    } else if (type === 'boolean') {
        return Boolean(field)
    }
    return field
}

export function bind(from: any, schemas?: Schema[]): any {
    const to: any = {};
    for (const key in from) {
        if(from[key] != undefined) {
            if (!schemas || schemas.find(schema => schema.field === key)) {
                to[key] = from[key]
            }
        }
    }
    return to
}