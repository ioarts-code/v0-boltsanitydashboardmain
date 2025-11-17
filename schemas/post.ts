export default {
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required().custom(async (slug: any, context: any) => {
        const {document, getClient} = context
        const client = getClient({apiVersion: '2023-01-01'})
        const id = document._id.replace(/^drafts\./, '')
        const params = {
          draft: `drafts.${id}`,
          published: id,
          slug: slug.current,
        }
        const query = `!defined(*[_type == "post" && slug.current == $slug && !(_id in [$draft, $published])][0]._id)`
        const result = await client.fetch(query, params)
        return result ? true : 'Slug is already in use'
      }),
    },
    {
      name: 'content',
      title: 'Content',
      type: 'text',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'image',
      title: 'image',
      type: 'image',
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: 'price',
      title: 'Price',
      type: 'number',
      validation: (Rule: any) => Rule.required().min(0),
    },
    {
      name: 'category',
      title: 'Category',
      type: 'array',
      of: [
        {
          type: 'string',
          options: {
            list: [
              { title: 'Controllers', value: 'controllers' },
              { title: 'Games', value: 'games' },
              { title: 'Swedish', value: 'swedish' },
              { title: 'Cinematic', value: 'cinematic' },
              { title: 'Music', value: 'music' },
              { title: 'Misc', value: 'misc' },
            ],
          },
        },
      ],
      validation: (Rule: any) => Rule.required().min(1),
    },
  ],
};
